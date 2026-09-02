// models/LearningPathway.js
//
// An SHS learning area / pathway. See learnda-dev-guide.md §4.4.
//
// SHS is not modelled like Primary or JHS: a learner takes core subjects plus
// electives chosen through a pathway, and the app must never show every SHS
// subject to every learner. Which subjects a pathway offers, and in which
// class years, lives in PathwaySubjectRule.
const { DataTypes } = require('sequelize');
const { LEVEL_GROUPS } = require('../config/educationStructure');

module.exports = (sequelize) => {
  const LearningPathway = sequelize.define('LearningPathway', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    slug: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
      validate: {
        is: {
          args: /^[a-z0-9]+(_[a-z0-9]+)*$/,
          msg: 'slug must be lower_snake_case, e.g. "general_arts"'
        }
      }
    },
    name: {
      type: DataTypes.STRING(160),
      allowNull: false
    },
    // Pathways exist only at SHS today. Kept explicit so the column can widen
    // later without the meaning of existing rows changing.
    level_group: {
      type: DataTypes.ENUM(LEVEL_GROUPS.SHS),
      allowNull: false,
      defaultValue: LEVEL_GROUPS.SHS
    },
    // §4.4.9: the STEM pathway is offered only by designated STEM schools, so
    // it must never appear for a learner whose school is not one.
    is_stem_only: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    }
  }, {
    tableName: 'learning_pathways',
    underscored: true,
    timestamps: true,
    indexes: [
      { name: 'learning_pathways_slug_uidx', unique: true, fields: ['slug'] },
      { name: 'learning_pathways_active_idx', fields: ['is_active', 'sort_order'] }
    ]
  });

  LearningPathway.associate = (models) => {
    if (models.PathwaySubjectRule) {
      LearningPathway.hasMany(models.PathwaySubjectRule, {
        foreignKey: 'pathway_id',
        as: 'subject_rules'
      });
    }
    if (models.AcademicProfile) {
      LearningPathway.hasMany(models.AcademicProfile, {
        foreignKey: 'pathway_id',
        as: 'learners'
      });
    }
  };

  return LearningPathway;
};
