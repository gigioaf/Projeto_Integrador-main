const { pool } = require('../config/db')
const { addPointsToUser } = require('../queries/pointsQueries')

const VALID_STATUSES = ['todo', 'in_progress', 'done', 'approved', 'rejected']

async function createTask(req, res) {
  try {
    const { title, description, points = 10, deadline, assignee_id } = req.body

    if (req.user?.role !== 'gestor') {
      return res.status(403).json({ error: 'Apenas gestores podem criar tarefas' })
    }

    if (!title) {
      return res.status(400).json({ error: 'Título é obrigatório' })
    }
    if (!assignee_id) {
      return res.status(400).json({ error: 'Responsável é obrigatório' })
    }

    // Validar assignee (deve ser subordinado direto do gestor)
    const assigneeResult = await pool.query('SELECT id, gestor_id FROM users WHERE id = $1', [assignee_id])
    const assignee = assigneeResult.rows[0]

    if (!assignee || assignee.gestor_id !== req.user.id) {
      return res.status(403).json({ error: 'Você só pode atribuir tarefas a subordinados diretos' })
    }

    const insertResult = await pool.query(
      `INSERT INTO tasks (title, description, points, deadline, assignee_id, created_by, gestor_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'todo')
       RETURNING id, title, description, status, points, deadline, assignee_id, created_by, gestor_id, created_at, updated_at`,
      [title, description || null, points, deadline || null, assignee_id, req.user.id, req.user.id]
    )

    return res.status(201).json({
      message: 'Tarefa criada com sucesso',
      task: insertResult.rows[0],
    })
  } catch (error) {
    console.error('createTask error:', error)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

async function getTasks(req, res) {
  try {
    const { id: userId, nivel } = req.user

    const isAdmin = nivel >= 3
    const whereClause = isAdmin
      ? 'TRUE'
      : nivel >= 2
        ? '(t.gestor_id = $1 OR t.assignee_id = $1)'
        : 't.assignee_id = $1'

    const query = `SELECT
         t.*,
         u.name  AS assignee_name,
         u.email AS assignee_email,
         u.role  AS assignee_role
       FROM tasks t
       LEFT JOIN users u ON t.assignee_id = u.id
       WHERE ${whereClause} AND t.deleted = FALSE
       ORDER BY t.created_at DESC`

    const params = isAdmin ? [] : [userId]

    const result = await pool.query(query, params)

    return res.status(200).json({ tasks: result.rows })
  } catch (error) {
    console.error('getTasks error:', error)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

async function updateTaskStatus(req, res) {
  try {
    const { id } = req.params
    const { status, evidence } = req.body

    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: "Status inválido. Use: todo, in_progress, done, approved ou rejected" })
    }

    const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [id])
    const task = taskResult.rows[0]

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' })
    }

    // Somente o responsável pode marcar como em progresso/concluída
    if (task.assignee_id !== req.user.id) {
      return res.status(403).json({ error: 'Você só pode alterar o status das suas próprias tarefas' })
    }

    if (['approved', 'rejected'].includes(status)) {
      return res.status(403).json({ error: 'Use /tasks/:id/review para aprovar ou reprovar tarefas' })
    }

    // Adiciona pontos ao usuário quando a tarefa passa para done (Low/Medium/High)
    let awardedPoints = 0
    let sendForReview = false

    if (status === 'done' && task.status !== 'done' && !task.credited) {
      // Removido: não creditar pontos automaticamente ao marcar como done
      // Apenas sinaliza que será enviada para aprovação
      sendForReview = true
    }

    const updates = ['status = $1', 'updated_at = NOW()']
    const values = [status]

    if (status === 'done' && evidence) {
      updates.push(`evidence = $${values.length + 1}`)
      values.push(evidence)
    }

    // Removido: não marcar credited como TRUE ao marcar como done
    // if (status === 'done' && task.status !== 'done' && !task.credited) {
    //   updates.push('credited = TRUE')
    // }

    const idPlaceholder = `$${values.length + 1}`
    const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ${idPlaceholder} RETURNING id, status, evidence, updated_at`

    values.push(id)

    const updated = await pool.query(query, values)

    const message = sendForReview
      ? 'Tarefa enviada para aprovação do gestor.'
      : 'Status atualizado com sucesso'

    return res.status(200).json({ message, task: updated.rows[0] })
  } catch (error) {
    console.error('updateTaskStatus error:', error)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

async function reviewTask(req, res) {
  try {
    const { id } = req.params
    const { action, feedback } = req.body

    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: "A ação deve ser 'approve' ou 'reject'" })
    }

    const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [id])
    const task = taskResult.rows[0]

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' })
    }

    if (task.created_by !== req.user.id) {
      return res.status(403).json({ error: 'Você só pode revisar tarefas que você atribuiu' })
    }

    if (task.status !== 'done') {
      return res.status(400).json({ error: 'Somente tarefas concluídas podem ser enviadas para aprovação' })
    }

    if (['approved', 'rejected'].includes(task.status)) {
      return res.status(400).json({ error: 'Tarefa já foi revisada' })
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    let awardedPoints = 0

    if (action === 'approve' && !task.credited) {
      await addPointsToUser(task.assignee_id, task.points || 0)
      awardedPoints = task.points || 0
    }

    await pool.query(
      'UPDATE tasks SET status = $1, reviewed_by = $2, reviewed_at = NOW(), credited = $3, updated_at = NOW() WHERE id = $4',
      [newStatus, req.user.id, action === 'approve', id]
    )

    const userPointResult = await pool.query('SELECT points FROM users WHERE id = $1', [task.assignee_id])
    const currentPoints = userPointResult.rows[0]?.points || 0

    return res.status(200).json({
      message: `Tarefa ${action === 'approve' ? 'aprovada' : 'reprovada'} com sucesso`,
      pointsCredited: awardedPoints,
      updatedPoints: currentPoints,
      assigneeId: task.assignee_id,
    })
  } catch (error) {
    console.error('reviewTask error:', error)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

async function updateTask(req, res) {
  try {
    const { id } = req.params
    const { title, description, points, deadline, assignee_id } = req.body

    const taskResult = await pool.query('SELECT * FROM tasks WHERE id = $1', [id])
    const task = taskResult.rows[0]

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' })
    }

    if (task.gestor_id !== req.user.id) {
      return res.status(403).json({ error: 'Você não tem permissão para editar esta tarefa' })
    }

    if (assignee_id) {
      const assigneeResult = await pool.query('SELECT id, gestor_id FROM users WHERE id = $1', [assignee_id])
      const assignee = assigneeResult.rows[0]

      if (!assignee || (assignee.id !== req.user.id && assignee.gestor_id !== req.user.id)) {
        return res.status(403).json({ error: 'Você só pode atribuir tarefas a si mesmo ou aos seus subordinados' })
      }
    }

    const updates = []
    const values = []
    let idx = 1

    if (title !== undefined) {
      updates.push(`title = $${idx}`)
      values.push(title)
      idx++
    }
    if (description !== undefined) {
      updates.push(`description = $${idx}`)
      values.push(description)
      idx++
    }
    if (points !== undefined) {
      updates.push(`points = $${idx}`)
      values.push(points)
      idx++
    }
    if (deadline !== undefined) {
      updates.push(`deadline = $${idx}`)
      values.push(deadline)
      idx++
    }
    if (assignee_id !== undefined) {
      updates.push(`assignee_id = $${idx}`)
      values.push(assignee_id)
      idx++
    }

    if (updates.length === 0) {
      return res.status(200).json({ message: 'Tarefa atualizada com sucesso', task: { id: Number(id) } })
    }

    updates.push(`updated_at = NOW()`)

    const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, title, points, updated_at`
    values.push(id)

    const updated = await pool.query(query, values)

    return res.status(200).json({ message: 'Tarefa atualizada com sucesso', task: updated.rows[0] })
  } catch (error) {
    console.error('updateTask error:', error)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

async function deleteTask(req, res) {
  try {
    const { id } = req.params

    const taskResult = await pool.query('SELECT id, gestor_id FROM tasks WHERE id = $1', [id])
    const task = taskResult.rows[0]

    if (!task) {
      return res.status(404).json({ error: 'Tarefa não encontrada' })
    }

    const isAdmin = req.user.nivel >= 3
    const isTaskManager = task.gestor_id === req.user.id

    if (!isAdmin && !isTaskManager) {
      return res.status(403).json({ error: 'Você não tem permissão para excluir esta tarefa' })
    }

    await pool.query('UPDATE tasks SET deleted = TRUE, deleted_at = NOW() WHERE id = $1', [id])
    return res.status(200).json({ message: 'Tarefa excluída com sucesso' })
  } catch (error) {
    console.error('deleteTask error:', error)
    return res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

module.exports = {
  createTask,
  getTasks,
  updateTaskStatus,
  reviewTask,
  updateTask,
  deleteTask,
}
