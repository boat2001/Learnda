// models/Institution.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Institution = sequelize.define('Institution', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    domain: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'institutions',
    underscored: true,
    timestamps: true
  });

  Institution.associate = (models) => {
    Institution.hasMany(models.User, { foreignKey: 'institution_id', as: 'users' });
    if (models.AcademicProfile) {
      Institution.hasMany(models.AcademicProfile, {
        foreignKey: 'institution_id',
        as: 'academic_profiles'
      });
    }
    if (models.RegistrationSession) {
      Institution.hasMany(models.RegistrationSession, {
        foreignKey: 'institution_id',
        as: 'registration_sessions'
      });
    }
    if (models.StudyGroup) {
      Institution.hasMany(models.StudyGroup, {
        foreignKey: 'institution_id',
        as: 'study_groups'
      });
    }
    if (models.Program) {
      Institution.hasMany(models.Program, {
        foreignKey: 'institution_id',
        as: 'programs'
      });
    }
  };

  return Institution;
};
