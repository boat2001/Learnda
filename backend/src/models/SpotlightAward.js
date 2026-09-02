const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const SpotlightAward = sequelize.define('SpotlightAward', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    award_id: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true
    },
    award_type: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    cycle_key: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    period_start: {
      type: DataTypes.DATE,
      allowNull: true
    },
    period_end: {
      type: DataTypes.DATE,
      allowNull: true
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    snapshot: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'spotlight_awards',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['award_type', 'cycle_key'] },
      { fields: ['user_id', 'award_type'] }
    ]
  });

  SpotlightAward.associate = (models) => {
    SpotlightAward.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return SpotlightAward;
};
