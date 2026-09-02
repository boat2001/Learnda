// models/ContentMetadata.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ContentMetadata = sequelize.define('ContentMetadata', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    content_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    course: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    topic: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    level: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    subject: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'content_metadata',
    underscored: true,
    timestamps: true
  });

  ContentMetadata.associate = () => {
    // content_id is a soft reference — no FK constraint
  };

  return ContentMetadata;
};
