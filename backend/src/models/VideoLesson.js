const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const VideoLesson = sequelize.define('VideoLesson', {
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
    file_url: { type: DataTypes.STRING(500), allowNull: true },
    video_url: { type: DataTypes.STRING(1000), allowNull: true },
    duration_minutes: { type: DataTypes.INTEGER, allowNull: true },
    level: { type: DataTypes.STRING(20), allowNull: true },
    semester: { type: DataTypes.STRING(20), allowNull: true },
    section: { type: DataTypes.STRING(200), allowNull: true },
    metadata: { type: DataTypes.JSONB, defaultValue: {} },
    published_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'video_lessons',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['course_id'] },
      { fields: ['status'] },
      { fields: ['creator_id'] },
      { fields: ['tags'], using: 'gin' },
    ],
  });

  VideoLesson.associate = (models) => {
    VideoLesson.belongsTo(models.User, { foreignKey: 'creator_id', as: 'creator' });
    VideoLesson.belongsTo(models.Course, { foreignKey: 'course_id', as: 'course', constraints: false });
    VideoLesson.hasOne(models.ContentStats, { foreignKey: 'content_id', as: 'stats', constraints: false });
    VideoLesson.hasMany(models.ContentEngagement, { foreignKey: 'content_id', as: 'engagements', constraints: false });
    VideoLesson.hasMany(models.Comment, { foreignKey: 'content_id', as: 'comments', constraints: false });
    VideoLesson.hasMany(models.Contribution, { foreignKey: 'content_id', as: 'contributions', constraints: false });
  };

  return VideoLesson;
};
