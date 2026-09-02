const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AcademicProfile = sequelize.define('AcademicProfile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true
    },
    institution_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    affiliate_university: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    programme_category: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    program_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    level: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    semester: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    index_number: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    student_identifier_type: {
      type: DataTypes.ENUM('index_number', 'application_number'),
      allowNull: false,
      defaultValue: 'index_number'
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'academic_profiles',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'academic_profiles_user_id_uidx',
        unique: true,
        fields: ['user_id']
      },
      {
        name: 'academic_profiles_inst_cat_level_sem_idx',
        fields: ['institution_id', 'programme_category', 'level', 'semester']
      },
      {
        name: 'academic_profiles_program_id_idx',
        fields: ['program_id']
      }
    ]
  });

  AcademicProfile.associate = (models) => {
    AcademicProfile.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    AcademicProfile.belongsTo(models.Institution, {
      foreignKey: 'institution_id',
      as: 'institution'
    });
    AcademicProfile.belongsTo(models.Program, {
      foreignKey: 'program_id',
      as: 'program_record'
    });
  };

  return AcademicProfile;
};
