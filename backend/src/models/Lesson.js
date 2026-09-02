const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Lesson = sequelize.define('Lesson', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING(500), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    course_id: { type: DataTypes.UUID, allowNull: true },
    lesson_number: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.STRING(20), defaultValue: 'published' },
    is_premium: { type: DataTypes.BOOLEAN, defaultValue: false },
    creator_id: { type: DataTypes.UUID, allowNull: false },
    depth_level: { type: DataTypes.STRING(20), defaultValue: 'basic' },
    tags: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    thumbnail_url: { type: DataTypes.STRING(500), allowNull: true },
    word_count: { type: DataTypes.INTEGER, allowNull: true },
    duration_minutes: { type: DataTypes.INTEGER, allowNull: true },
    reading_time: { type: DataTypes.INTEGER, allowNull: true },
    slug: { type: DataTypes.STRING(200), allowNull: true },
    level: { type: DataTypes.STRING(20), allowNull: true },
    semester: { type: DataTypes.STRING(20), allowNull: true },
    source: { type: DataTypes.STRING(100), allowNull: true },
    lesson_document: { type: DataTypes.JSONB, defaultValue: {} },
    exercises: { type: DataTypes.JSONB, defaultValue: [] },
    // Deeper typed/theory questions reserved exclusively for the end-of-lesson
    // final test — kept separate from `exercises` (per-chunk, 100% objective).
    final_assessment: { type: DataTypes.JSONB, defaultValue: [] },
    objectives: { type: DataTypes.JSONB, defaultValue: [] },
    metadata: { type: DataTypes.JSONB, defaultValue: {} },
    published_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'lessons',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['course_id'] },
      { fields: ['status'] },
      { fields: ['creator_id'] },
      { fields: ['tags'], using: 'gin' },
    ],
  });

  Lesson.associate = (models) => {
    Lesson.belongsTo(models.User, { foreignKey: 'creator_id', as: 'creator' });
    Lesson.belongsTo(models.Course, { foreignKey: 'course_id', as: 'course', constraints: false });
    Lesson.hasOne(models.ContentStats, { foreignKey: 'content_id', as: 'stats', constraints: false });
    Lesson.hasOne(models.ContentMetadata, { foreignKey: 'content_id', as: 'metadata_details', constraints: false });
    Lesson.hasMany(models.ContentEngagement, { foreignKey: 'content_id', as: 'engagements', constraints: false });
    Lesson.hasMany(models.Comment, { foreignKey: 'content_id', as: 'comments', constraints: false });
    Lesson.hasMany(models.Contribution, { foreignKey: 'content_id', as: 'contributions', constraints: false });
  };

  return Lesson;
};
