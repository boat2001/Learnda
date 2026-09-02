const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserContact = sequelize.define('UserContact', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    contact_type: {
      type: DataTypes.ENUM('email', 'phone'),
      allowNull: false
    },
    contact_value: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    normalized_value: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    is_primary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'user_contacts',
    timestamps: true,
    underscored: true,
    indexes: [
      { unique: true, fields: ['contact_type', 'normalized_value'] },
      { unique: true, fields: ['user_id', 'contact_type', 'normalized_value'] },
      { fields: ['user_id', 'is_primary'] }
    ]
  });

  UserContact.associate = (models) => {
    UserContact.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return UserContact;
};
