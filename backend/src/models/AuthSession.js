const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const AuthSession = sequelize.define('AuthSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    session_token_hash: {
      type: DataTypes.STRING(255),
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
    device_vendor: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    device_model: {
      type: DataTypes.STRING(120),
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
    screen_width: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    screen_height: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    is_mobile: {
      type: DataTypes.BOOLEAN,
      allowNull: true
    },
    is_trusted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    last_seen_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'auth_sessions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'last_seen_at'] },
      { unique: true, fields: ['session_token_hash'] }
    ]
  });

  AuthSession.associate = (models) => {
    AuthSession.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return AuthSession;
};
