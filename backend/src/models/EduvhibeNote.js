const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EduvhibeNote = sequelize.define('EduvhibeNote', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    file_name: { type: DataTypes.STRING(255), allowNull: false },
    file_url: { type: DataTypes.STRING(500), allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: true },
    file_type: { type: DataTypes.STRING(100), allowNull: true },
    file_size: { type: DataTypes.INTEGER, allowNull: true },
    course: { type: DataTypes.STRING(255), allowNull: true },
    level: { type: DataTypes.STRING(50), allowNull: true },
    semester: { type: DataTypes.STRING(50), allowNull: true },
    is_premium: { type: DataTypes.BOOLEAN, defaultValue: false },
    downloads: { type: DataTypes.INTEGER, defaultValue: 0 },
    views: { type: DataTypes.INTEGER, defaultValue: 0 },
    last_viewed_at: { type: DataTypes.DATE, allowNull: true },
    last_downloaded_at: { type: DataTypes.DATE, allowNull: true },
    uploader_id: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'eduvhibe_notes',
    underscored: true,
    timestamps: true
  });

  EduvhibeNote.associate = (models) => {
    if (models.User) {
      EduvhibeNote.belongsTo(models.User, { foreignKey: 'uploader_id', as: 'uploader' });
    }
  };

  return EduvhibeNote;
};
