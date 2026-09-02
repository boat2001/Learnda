const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PaymentTransaction = sequelize.define('PaymentTransaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    registration_session_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    plan_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    provider: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'paystack'
    },
    status: {
      type: DataTypes.ENUM('success', 'pending', 'failed', 'refunded'),
      allowNull: false,
      defaultValue: 'success'
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'GHS'
    },
    transaction_reference: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    provider_transaction_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    paid_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    billing_kind: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    duration_months: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    customer_contact: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'payment_transactions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'created_at'] },
      { fields: ['provider', 'transaction_reference'], unique: true },
      { fields: ['provider', 'provider_transaction_id'], unique: true }
    ]
  });

  PaymentTransaction.associate = (models) => {
    PaymentTransaction.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    PaymentTransaction.belongsTo(models.Plan, {
      foreignKey: 'plan_id',
      as: 'plan'
    });

    if (models.RegistrationSession) {
      PaymentTransaction.belongsTo(models.RegistrationSession, {
        foreignKey: 'registration_session_id',
        as: 'registration_session'
      });
    }
  };

  return PaymentTransaction;
};
