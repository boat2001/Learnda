// models/Plan.js
const { DataTypes, Op } = require('sequelize');
const { SUBSCRIPTION_PLANS } = require('../utils/constants');

module.exports = (sequelize) => {
  const Plan = sequelize.define('Plan', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    billing_cycle: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'monthly'
    },
    paystack_plan_code: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    max_pls_items: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    max_contributions: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'plans',
    timestamps: true,
    underscored: true
  });

  Plan.associate = (models) => {
    Plan.hasMany(models.PlanFeature, {
      foreignKey: 'plan_id',
      as: 'features'
    });
    
    Plan.hasMany(models.Subscription, {
      foreignKey: 'plan_id',
      as: 'subscriptions'
    });

    if (models.PaymentTransaction) {
      Plan.hasMany(models.PaymentTransaction, {
        foreignKey: 'plan_id',
        as: 'payment_transactions'
      });
    }

    if (models.RegistrationSession) {
      Plan.hasMany(models.RegistrationSession, {
        foreignKey: 'selected_plan_id',
        as: 'registration_sessions'
      });
    }
  };

  Plan.initializeDefaultPlans = async function() {
    const plans = [
      {
        name: 'Basic Student',
        description: 'Free access to basic learning resources',
        price: 0,
        billing_cycle: 'monthly',
        max_pls_items: 10,
        max_contributions: 0
      },
      {
        name: 'Serious Student',
        description: 'Enhanced learning with contribution capabilities',
        price: 5,
        billing_cycle: 'monthly',
        max_pls_items: null, // unlimited
        max_contributions: 10
      },
      {
        name: 'Master Student',
        description: 'Full access with advanced features and higher revenue share',
        price: 10,
        billing_cycle: 'monthly',
        max_pls_items: null, // unlimited
        max_contributions: null // unlimited
      }
    ];

    await Plan.update(
      { is_active: false },
      { where: { name: { [Op.iLike]: '%institution%' } } }
    );

    for (const planData of plans) {
      const plan = await Plan.findOrCreate({
        where: { name: planData.name },
        defaults: planData
      });
      
      // Initialize features based on plan
      await this.initializePlanFeatures(plan[0]);
    }
  };

  Plan.initializePlanFeatures = async function(plan) {
    const planConfig = SUBSCRIPTION_PLANS[plan.name.toUpperCase().replace(' ', '_')];
    
    if (planConfig && planConfig.features) {
      for (const feature of planConfig.features) {
        await sequelize.models.PlanFeature.findOrCreate({
          where: {
            plan_id: plan.id,
            feature_key: feature.key
          },
          defaults: {
            enabled: feature.enabled,
            config: feature
          }
        });
      }
    }
  };

  Plan.prototype.hasFeature = function(featureKey) {
    if (!this.features) return false;
    
    const feature = this.features.find(f => f.feature_key === featureKey);
    return feature ? feature.enabled : false;
  };

  Plan.prototype.getFeatureConfig = function(featureKey) {
    if (!this.features) return null;
    
    const feature = this.features.find(f => f.feature_key === featureKey);
    return feature ? feature.config : null;
  };

  return Plan;
};
