// models/Subscription.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Subscription = sequelize.define('Subscription', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    plan_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('active', 'pending', 'canceled', 'expired'),
      defaultValue: 'active'
    },
    started_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    canceled_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancel_at_period_end: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    cancel_requested_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    payment_reference: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    payment_metadata: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    next_billing_date: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'user_subscriptions',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id', 'status', 'expires_at']
      }
    ]
  });

  Subscription.associate = (models) => {
    Subscription.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
    
    Subscription.belongsTo(models.Plan, {
      foreignKey: 'plan_id',
      as: 'plan'
    });
  };

  Subscription.prototype.isActive = function() {
    const now = new Date();
    return this.status === 'active' && 
           (!this.expires_at || new Date(this.expires_at) > now);
  };

  Subscription.prototype.daysRemaining = function() {
    if (!this.expires_at) return null;
    const now = new Date();
    const expires = new Date(this.expires_at);
    const diffTime = expires - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return Subscription;
};
