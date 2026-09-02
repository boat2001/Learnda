const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const StudyGroupMember = sequelize.define('StudyGroupMember', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    group_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('owner', 'moderator', 'member'),
      allowNull: false,
      defaultValue: 'member'
    },
    status: {
      type: DataTypes.ENUM('active', 'left', 'removed'),
      allowNull: false,
      defaultValue: 'active'
    },
    joined_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    left_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'study_group_members',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['group_id', 'user_id'] },
      { fields: ['user_id', 'status'] }
    ]
  });

  StudyGroupMember.associate = (models) => {
    StudyGroupMember.belongsTo(models.StudyGroup, {
      foreignKey: 'group_id',
      as: 'group'
    });
    StudyGroupMember.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return StudyGroupMember;
};
