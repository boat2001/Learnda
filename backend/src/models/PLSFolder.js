// models/PLSFolder.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PLSFolder = sequelize.define('PLSFolder', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    color: {
      type: DataTypes.STRING(50),
      allowNull: true
    }
  }, {
    tableName: 'pls_folders',
    underscored: true,
    timestamps: true
  });

  PLSFolder.associate = (models) => {
    PLSFolder.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    PLSFolder.hasMany(models.PLSItem, { foreignKey: 'parent_id', as: 'items' });
    PLSFolder.hasMany(models.PLSFolderItem, { foreignKey: 'folder_id', as: 'folder_items' });
  };

  return PLSFolder;
};
