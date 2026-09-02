// models/PathwaySubjectRule.js
//
// Which subjects an SHS pathway offers, in which class years, and how many a
// learner must pick from each group. See learnda-dev-guide.md §4.4.
//
// This is what stops the app showing every SHS subject to every learner: a
// learner's visible subject list is the intersection of their class, their
// pathway, and their school's availability.
//
// The class band matters because Business is year-sensitive (§4.4.3):
//   SHS1        -> business_studies
//   SHS2..SHS3  -> business_management + accounting
const { DataTypes } = require('sequelize');
const {
  CLASS_LEVEL_CODES,
  PATHWAY_RULE_GROUPS,
  LEVEL_GROUPS,
  getOrdinal,
  getLevelGroup,
} = require('../config/educationStructure');

module.exports = (sequelize) => {
  const PathwaySubjectRule = sequelize.define('PathwaySubjectRule', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    pathway_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    learning_unit_id: {
      type: DataTypes.UUID,
      allowNull: false
    },
    rule_group: {
      type: DataTypes.ENUM(...Object.values(PATHWAY_RULE_GROUPS)),
      allowNull: false
    },
    // Selection bounds for the whole rule_group, not this single subject.
    // Both null means "no explicit limit"; the app then treats the group as
    // free choice among its subjects.
    min_select: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 }
    },
    max_select: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 }
    },
    // True when the learner must take this subject (all core subjects, and
    // the year-sensitive Business subjects).
    required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    from_class: {
      type: DataTypes.ENUM(...CLASS_LEVEL_CODES),
      allowNull: false,
      defaultValue: 'SHS1'
    },
    to_class: {
      type: DataTypes.ENUM(...CLASS_LEVEL_CODES),
      allowNull: false,
      defaultValue: 'SHS3'
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
    tableName: 'pathway_subject_rules',
    underscored: true,
    timestamps: true,
    indexes: [
      // One rule per subject per group per pathway; the class band separates
      // year-sensitive variants of the same subject.
      {
        name: 'pathway_subject_rules_unique_idx',
        unique: true,
        fields: ['pathway_id', 'learning_unit_id', 'rule_group', 'from_class', 'to_class']
      },
      { name: 'pathway_subject_rules_pathway_idx', fields: ['pathway_id', 'is_active'] },
      { name: 'pathway_subject_rules_group_idx', fields: ['rule_group'] },
      { name: 'pathway_subject_rules_band_idx', fields: ['from_class', 'to_class'] }
    ],
    validate: {
      classBandIsOrdered() {
        const from = getOrdinal(this.from_class);
        const to = getOrdinal(this.to_class);
        if (from === null || to === null) {
          throw new Error('PathwaySubjectRule: from_class/to_class must be valid class levels');
        }
        if (from > to) {
          throw new Error(
            `PathwaySubjectRule: from_class (${this.from_class}) is above to_class (${this.to_class})`
          );
        }
      },
      // Pathways are an SHS construct; a rule spanning below SHS would expose
      // SHS electives to JHS learners.
      bandIsWithinShs() {
        if (getLevelGroup(this.from_class) !== LEVEL_GROUPS.SHS ||
            getLevelGroup(this.to_class) !== LEVEL_GROUPS.SHS) {
          throw new Error(
            `PathwaySubjectRule: band ${this.from_class}..${this.to_class} must sit within SHS`
          );
        }
      },
      selectBoundsAreOrdered() {
        if (this.min_select != null && this.max_select != null && this.min_select > this.max_select) {
          throw new Error(
            `PathwaySubjectRule: min_select (${this.min_select}) exceeds max_select (${this.max_select})`
          );
        }
      }
    }
  });

  /** True when this rule applies to a learner sitting in `classLevelCode`. */
  PathwaySubjectRule.prototype.appliesAt = function appliesAt(classLevelCode) {
    const target = getOrdinal(classLevelCode);
    if (target === null) return false;
    return target >= getOrdinal(this.from_class) && target <= getOrdinal(this.to_class);
  };

  PathwaySubjectRule.associate = (models) => {
    if (models.LearningPathway) {
      PathwaySubjectRule.belongsTo(models.LearningPathway, {
        foreignKey: 'pathway_id',
        as: 'pathway'
      });
    }
    if (models.LearningUnit) {
      PathwaySubjectRule.belongsTo(models.LearningUnit, {
        foreignKey: 'learning_unit_id',
        as: 'learning_unit'
      });
    }
  };

  return PathwaySubjectRule;
};
