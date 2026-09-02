const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StudyGroup = sequelize.define('StudyGroup', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    creator_user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    course_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    institution_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    visibility: {
      type: DataTypes.ENUM('public', 'private', 'invite_only'),
      allowNull: false,
      defaultValue: 'public'
    },
    join_requirement: {
      type: DataTypes.ENUM('serious_or_master', 'master_only'),
      allowNull: false,
      defaultValue: 'serious_or_master'
    },
    status: {
      type: DataTypes.ENUM('active', 'archived', 'closed'),
      allowNull: false,
      defaultValue: 'active'
    },
    member_limit: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'study_groups',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['creator_user_id'] },
      { fields: ['course_id', 'status'] },
      { fields: ['institution_id', 'status'] }
    ]
  });

  StudyGroup.associate = (models) => {
    StudyGroup.belongsTo(models.User, {
      foreignKey: 'creator_user_id',
      as: 'creator'
    });
    if (models.Course) {
      StudyGroup.belongsTo(models.Course, {
        foreignKey: 'course_id',
        as: 'course'
      });
    }
    StudyGroup.belongsTo(models.Institution, {
      foreignKey: 'institution_id',
      as: 'institution'
    });
    if (models.StudyGroupMember) {
      StudyGroup.hasMany(models.StudyGroupMember, {
        foreignKey: 'group_id',
        as: 'members'
      });
    }
    if (models.StudyGroupMessage) {
      StudyGroup.hasMany(models.StudyGroupMessage, {
        foreignKey: 'group_id',
        as: 'messages'
      });
    }
  };

  return StudyGroup;
};
