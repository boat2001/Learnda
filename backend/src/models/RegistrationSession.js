const { DataTypes } = require('sequelize');
const { CLASS_LEVEL_CODES } = require('../config/educationStructure');

module.exports = (sequelize) => {
  const RegistrationSession = sequelize.define('RegistrationSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    contact_type: {
      type: DataTypes.ENUM('email', 'phone'),
      allowNull: false
    },
    contact_value: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    normalized_contact: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    otp_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: true
    },
    full_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    // Class placement captured during sign-up (§6.2). Nullable because
    // onboarding is progressive: a learner enters with a name, and picks a
    // class before opening content.
    class_level: {
      type: DataTypes.ENUM(...CLASS_LEVEL_CODES),
      allowNull: true
    },
    // SHS only (§4.4): the pathway the learner is offering.
    pathway_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    is_stem_school: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    selected_plan_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    duration_months: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    stage: {
      type: DataTypes.ENUM('IDENTITY', 'ACADEMIC', 'PLAN', 'PAYMENT', 'DONE', 'ABANDONED'),
      allowNull: false,
      defaultValue: 'IDENTITY'
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'registration_sessions',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['contact_type', 'normalized_contact'] },
      { fields: ['stage'] },
      { fields: ['expires_at'] }
    ]
  });

  RegistrationSession.associate = (models) => {
    RegistrationSession.belongsTo(models.Plan, {
      foreignKey: 'selected_plan_id',
      as: 'selected_plan'
    });
    if (models.RegistrationOtp) {
      RegistrationSession.hasMany(models.RegistrationOtp, {
        foreignKey: 'registration_session_id',
        as: 'otp_challenges'
      });
    }
    if (models.PaymentTransaction) {
      RegistrationSession.hasMany(models.PaymentTransaction, {
        foreignKey: 'registration_session_id',
        as: 'payment_transactions'
      });
    }
    if (models.RegistrationSecurityEvent) {
      RegistrationSession.hasMany(models.RegistrationSecurityEvent, {
        foreignKey: 'registration_session_id',
        as: 'security_events'
      });
    }
  };

  return RegistrationSession;
};
