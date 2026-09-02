// models/Contribution.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Contribution = sequelize.define('Contribution', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    uploader_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    kind: {
      type: DataTypes.ENUM('file', 'lesson', 'blog', 'quiz'),
      defaultValue: 'file'
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    course: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    level: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    // For file contributions
    file_path: {
      type: DataTypes.STRING(800),
      allowNull: true
    },
    original_name: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    mime_type: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // For text/lesson/blog contributions
    body: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected'),
      defaultValue: 'pending'
    },
    reviewed_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    review_notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    content_id: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    tableName: 'contributions',
    underscored: true,
    timestamps: true
  });

  Contribution.associate = (models) => {
    Contribution.belongsTo(models.User, { foreignKey: 'uploader_id', as: 'uploader' });
    Contribution.belongsTo(models.User, { foreignKey: 'reviewed_by', as: 'reviewer' });
    // content_id is a soft reference — no FK constraint
  };

  return Contribution;
};
