const { buildAllContentViewSql, refreshAllContentView } = require('../lib/allContentView');

test('supports class-based lessons without legacy course columns', () => {
  const sql = buildAllContentViewSql(['id', 'class_level_code']);
  expect(sql).toContain('NULL::UUID AS course_id, lesson_number, class_level_code::TEXT AS level');
  expect(sql).toContain('CREATE OR REPLACE VIEW');
});

test('preserves compatibility with legacy lesson schemas', () => {
  expect(buildAllContentViewSql(['course_id', 'level'])).toContain('course_id, lesson_number, level::TEXT AS level');
});

test('checks the schema before updating the view without dropping it', async () => {
  const client = { query: jest.fn().mockResolvedValueOnce({ rows: [{ column_name: 'class_level_code' }] }).mockResolvedValue({}) };
  await refreshAllContentView(client);
  expect(client.query).toHaveBeenCalledTimes(2);
  expect(client.query.mock.calls[1][0]).not.toContain('DROP VIEW');
});

test('fails clearly when the lessons table is missing', async () => {
  const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
  await expect(refreshAllContentView(client)).rejects.toThrow('lessons table is missing');
  expect(client.query).toHaveBeenCalledTimes(1);
});
