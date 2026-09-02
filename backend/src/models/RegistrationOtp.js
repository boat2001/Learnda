const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const RegistrationOtp = sequelize.define('RegistrationOtp', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    registration_session_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    channel: {
      type: DataTypes.ENUM('email', 'phone'),
      allowNull: false,
      defaultValue: 'email'
    },
    contact_value: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    challenge_token: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true
    },
    otp_hash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false
    },
    attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'registration_otps',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['email']
      },
      {
        fields: ['registration_session_id']
      },
      {
        unique: true,
        fields: ['challenge_token']
      },
      {
        fields: ['expires_at']
      }
    ]
  });

  RegistrationOtp.associate = (models) => {
    if (models.RegistrationSession) {
      RegistrationOtp.belongsTo(models.RegistrationSession, {
        foreignKey: 'registration_session_id',
        as: 'registration_session'
      });
    }
  };

  return RegistrationOtp;
};
