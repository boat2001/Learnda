// models/PLSItem.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PLSItem = sequelize.define('PLSItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    content_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    item_type: {
      type: DataTypes.STRING(50),
      defaultValue: 'course'
    },
    parent_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    is_favorite: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    custom_order: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    file_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'pls_items',
    underscored: true,
    timestamps: true
  });

  PLSItem.associate = (models) => {
    PLSItem.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    // content_id is a soft reference — no FK constraint
    PLSItem.belongsTo(models.PLSFolder, { foreignKey: 'parent_id', as: 'folder' });
  };

  return PLSItem;
};
