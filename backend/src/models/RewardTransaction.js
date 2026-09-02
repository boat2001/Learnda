const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RewardTransaction = sequelize.define('RewardTransaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM(
        'invite_download',
        'invite_register',
        'streak_7_day',
        'contribute_bonus'
      ),
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'paid', 'rejected'),
      defaultValue: 'approved'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'reward_transactions',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['user_id', 'type'] }]
  });

  RewardTransaction.associate = (models) => {
    RewardTransaction.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return RewardTransaction;
};
