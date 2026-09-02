const { DataTypes } = require('sequelize');

const TEXT_ITEM_SUBTYPES = [
  'story', 'quote', 'fact', 'jocular',
  'article', 'blog_post', 'guide', 'note', 'announcement',
  'quiz', 'exam', 'past_question',
];

module.exports = (sequelize) => {
  const TextItem = sequelize.define('TextItem', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    subtype: { type: DataTypes.STRING(50), allowNull: false },
    title: { type: DataTypes.STRING(500), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    body: { type: DataTypes.TEXT, allowNull: true },
    author: { type: DataTypes.STRING(200), allowNull: true },
    category: { type: DataTypes.STRING(200), allowNull: true },
    tone: { type: DataTypes.STRING(100), allowNull: true },
    key_lesson: { type: DataTypes.TEXT, allowNull: true },
    slug: { type: DataTypes.STRING(200), allowNull: true },
    status: { type: DataTypes.STRING(20), defaultValue: 'published' },
    is_premium: { type: DataTypes.BOOLEAN, defaultValue: false },
    creator_id: { type: DataTypes.UUID, allowNull: false },
    depth_level: { type: DataTypes.STRING(20), defaultValue: 'basic' },
    tags: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
    word_count: { type: DataTypes.INTEGER, allowNull: true },
    reading_time: { type: DataTypes.INTEGER, allowNull: true },
    // quiz / exam / past_question
    questions: { type: DataTypes.JSONB, defaultValue: [] },
    // exam sections A and B
    sections: { type: DataTypes.JSONB, defaultValue: {} },
    metadata: { type: DataTypes.JSONB, defaultValue: {} },
    published_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'text_items',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['subtype'] },
      { fields: ['status'] },
      { fields: ['creator_id'] },
      { fields: ['category'] },
      { fields: ['tags'], using: 'gin' },
    ],
  });

  TextItem.SUBTYPES = TEXT_ITEM_SUBTYPES;

  TextItem.associate = (models) => {
    TextItem.belongsTo(models.User, { foreignKey: 'creator_id', as: 'creator' });
    TextItem.hasOne(models.ContentStats, { foreignKey: 'content_id', as: 'stats', constraints: false });
    TextItem.hasMany(models.ContentEngagement, { foreignKey: 'content_id', as: 'engagements', constraints: false });
    TextItem.hasMany(models.Comment, { foreignKey: 'content_id', as: 'comments', constraints: false });
    TextItem.hasMany(models.Contribution, { foreignKey: 'content_id', as: 'contributions', constraints: false });
    TextItem.hasMany(models.PastQuestionMode, { foreignKey: 'content_id', as: 'question_modes', constraints: false });
  };

  return TextItem;
};
