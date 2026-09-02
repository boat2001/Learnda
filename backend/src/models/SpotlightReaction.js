const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SpotlightReaction = sequelize.define('SpotlightReaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    award_id: {
      type: DataTypes.STRING(160),
      allowNull: false
    },
    award_type: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    target_user_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    action: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'celebrate'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'spotlight_reactions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['award_id', 'action'] },
      { fields: ['target_user_id', 'award_type'] },
      { unique: true, fields: ['award_id', 'user_id', 'action'] }
    ]
  });

  SpotlightReaction.associate = (models) => {
    SpotlightReaction.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    SpotlightReaction.belongsTo(models.User, {
      foreignKey: 'target_user_id',
      as: 'targetUser'
    });
  };

  return SpotlightReaction;
};
