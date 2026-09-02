// models/PLSFolderItem.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PLSFolderItem = sequelize.define('PLSFolderItem', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    folder_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    item_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    added_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'pls_folder_items',
    underscored: true,
    timestamps: false
  });

  PLSFolderItem.associate = (models) => {
    PLSFolderItem.belongsTo(models.PLSFolder, { foreignKey: 'folder_id', as: 'folder' });
    PLSFolderItem.belongsTo(models.PLSItem, { foreignKey: 'item_id', as: 'item' });
  };

  return PLSFolderItem;
};
