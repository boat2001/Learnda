// models/Program.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Program = sequelize.define('Program', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    key: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    institution_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'programs',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['key'], unique: true },
      { fields: ['category'] }
    ]
  });

  Program.associate = (models) => {
    if (models.Institution) {
      Program.belongsTo(models.Institution, {
        foreignKey: 'institution_id',
        as: 'institution'
      });
    }

    if (models.AcademicProfile) {
      Program.hasMany(models.AcademicProfile, {
        foreignKey: 'program_id',
        as: 'academic_profiles'
      });
    }

    if (models.RegistrationSession) {
      Program.hasMany(models.RegistrationSession, {
        foreignKey: 'program_id',
        as: 'registration_sessions'
      });
    }

    if (models.CourseOffering) {
      Program.hasMany(models.CourseOffering, {
        foreignKey: 'program_id',
        as: 'offerings'
      });
    }
  };

  return Program;
};
