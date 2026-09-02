const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RegistrationSecurityEvent = sequelize.define('RegistrationSecurityEvent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    registration_session_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    event_type: {
      type: DataTypes.ENUM(
        'session_started',
        'otp_sent',
        'otp_verified',
        'password_set',
        'academic_saved',
        'plan_selected',
        'payment_started',
        'payment_verified',
        'registration_completed'
      ),
      allowNull: false
    },
    ip_address: {
      type: DataTypes.STRING(64),
      allowNull: true
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    browser_name: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    browser_version: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    os_name: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    os_version: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    device_type: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    country_code: {
      type: DataTypes.STRING(8),
      allowNull: true
    },
    region: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    city: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    timezone: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    language: {
      type: DataTypes.STRING(40),
      allowNull: true
    },
    referrer: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'registration_security_events',
    timestamps: true,
    underscored: true,
    updatedAt: false,
    indexes: [
      { fields: ['registration_session_id', 'created_at'] },
      { fields: ['event_type'] }
    ]
  });

  RegistrationSecurityEvent.associate = (models) => {
    RegistrationSecurityEvent.belongsTo(models.RegistrationSession, {
      foreignKey: 'registration_session_id',
      as: 'registration_session'
    });
  };

  return RegistrationSecurityEvent;
};
