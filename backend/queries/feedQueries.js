const { pool } = require('../config/db')

async function getFeedEvents(limit = 10, page = 1) {
  const pageNumber = Number(page) || 1
  const pageLimit = Number(limit) || 10
  const offset = (pageNumber - 1) * pageLimit

  const result = await pool.query(
    `SELECT
      id,
      userid,
      username,
      userlevel,
      type,
      description,
      stampemoji,
      points,
      pointstype,
      isnew,
      createdat,
      isteam,
      reactions
    FROM (
      SELECT
        CONCAT('task-', t.id) AS id,
        t.assignee_id AS userid,
        u.name AS username,
        COALESCE(u.nivel, 1) AS userlevel,
        'task' AS type,
        CONCAT('Concluiu a tarefa "', COALESCE(t.title, 'tarefa'), '".') AS description,
        '⚡' AS stampemoji,
        COALESCE(t.points, 0) AS points,
        'blue' AS pointstype,
        FALSE AS isnew,
        COALESCE(t.reviewed_at, t.updated_at, t.created_at) AS createdat,
        TRUE AS isteam,
        '[]'::json AS reactions
      FROM tasks t
      JOIN users u ON t.assignee_id = u.id
      -- Preserva as notificações de tarefas aprovadas mesmo que a tarefa tenha sido excluída no Kanban
      WHERE t.status = 'approved'

      UNION ALL

      SELECT
        CONCAT('badge-', ub.id) AS id,
        ub.user_id AS userid,
        u.name AS username,
        COALESCE(u.nivel, 1) AS userlevel,
        'badge' AS type,
        CONCAT('Desbloqueou o selo "', COALESCE(b.name, 'selo'), '".') AS description,
        '🏅' AS stampemoji,
        0 AS points,
        'gold' AS pointstype,
        FALSE AS isnew,
        ub.unlocked_at AS createdat,
        TRUE AS isteam,
        '[]'::json AS reactions
      FROM user_badges ub
      JOIN users u ON ub.user_id = u.id
      JOIN badges b ON b.id = ub.badge_id
    ) AS combined_feed
    ORDER BY createdat DESC
    LIMIT $1 OFFSET $2`,
    [pageLimit, offset]
  )

  return result.rows
}

module.exports = {
  getFeedEvents,
}
