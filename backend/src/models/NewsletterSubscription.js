const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const NewsletterSubscription = sequelize.define('NewsletterSubscription', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    status: {
      type: DataTypes.ENUM('active', 'unsubscribed'),
      defaultValue: 'active'
    },
    source: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    unsubscribed_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'newsletter_subscriptions',
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ['email'] }]
  });

  return NewsletterSubscription;
};
