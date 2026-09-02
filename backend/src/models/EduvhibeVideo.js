const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EduvhibeVideo = sequelize.define('EduvhibeVideo', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    title: { type: DataTypes.STRING(500), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
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
    section: { type: DataTypes.STRING(200), allowNull: true },
    section_code: { type: DataTypes.STRING(50), allowNull: true },
    metadata: { type: DataTypes.JSONB, defaultValue: {} },
    published_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'eduvhibe_videos',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['status'] },
      { fields: ['creator_id'] },
      { fields: ['level'] },
      { fields: ['tags'], using: 'gin' },
    ],
  });

  EduvhibeVideo.associate = (models) => {
    EduvhibeVideo.belongsTo(models.User, { foreignKey: 'creator_id', as: 'creator' });
    EduvhibeVideo.hasOne(models.ContentStats, { foreignKey: 'content_id', as: 'stats', constraints: false });
    EduvhibeVideo.hasMany(models.ContentEngagement, { foreignKey: 'content_id', as: 'engagements', constraints: false });
    EduvhibeVideo.hasMany(models.Comment, { foreignKey: 'content_id', as: 'comments', constraints: false });
  };

  return EduvhibeVideo;
};
