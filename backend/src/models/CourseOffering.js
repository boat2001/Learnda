// models/CourseOffering.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const CourseOffering = sequelize.define('CourseOffering', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    program_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    course_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    level: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    semester: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    files_path: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'course_offerings',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['program_id'] },
      { fields: ['course_id'] },
      { fields: ['level', 'semester'] }
    ]
  });

  CourseOffering.associate = (models) => {
    if (models.Program) {
      CourseOffering.belongsTo(models.Program, {
        foreignKey: 'program_id',
        as: 'program'
      });
    }
    if (models.Course) {
      CourseOffering.belongsTo(models.Course, {
        foreignKey: 'course_id',
        as: 'course'
      });
    }
  };

  return CourseOffering;
};
