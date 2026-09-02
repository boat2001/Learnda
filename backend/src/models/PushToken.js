const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PushToken = sequelize.define('PushToken', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    token: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    platform: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    device: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    last_used_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'push_tokens',
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['token'] }]
  });

  PushToken.associate = (models) => {
    PushToken.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return PushToken;
};
