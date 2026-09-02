const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const EduvhibeCgpaEntry = sequelize.define(
    'EduvhibeCgpaEntry',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: DataTypes.UUID,
        allowNull: false
      },
      semester: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      course_name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      credits: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      grade: {
        type: DataTypes.STRING(10),
        allowNull: false
      },
      grade_points: {
        type: DataTypes.DECIMAL(4, 2),
        allowNull: false
      }
    },
    {
      tableName: 'eduvhibe_cgpa_entries',
      underscored: true,
      timestamps: true
    }
  );

  EduvhibeCgpaEntry.associate = (models) => {
    if (models.User) {
      EduvhibeCgpaEntry.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user'
      });
    }
  };

  return EduvhibeCgpaEntry;
};
