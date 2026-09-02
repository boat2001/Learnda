const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RewardPayout = sequelize.define('RewardPayout', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('requested', 'approved', 'paid', 'rejected'),
      defaultValue: 'requested'
    },
    destination: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    destination_telco: {
      type: DataTypes.STRING(60),
      allowNull: true
    },
    insights: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    requested_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    processed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'reward_payouts',
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ['user_id', 'status'] }]
  });

  RewardPayout.associate = (models) => {
    RewardPayout.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return RewardPayout;
};
