// models/UserBadge.js (minimal stub)
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserBadge = sequelize.define('UserBadge', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    badge_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    earned_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'user_badges',
    underscored: true,
    timestamps: true
  });

  UserBadge.associate = (models) => {
    UserBadge.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    UserBadge.belongsTo(models.Badge, { foreignKey: 'badge_id', as: 'badge' });
  };

  return UserBadge;
};
