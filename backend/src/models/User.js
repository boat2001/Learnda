// models/User.js
const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    full_name: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    auth_provider: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    provider_user_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('student', 'lecturer', 'admin', 'contributor'),
      defaultValue: 'student'
    },
    is_superadmin: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    admin_permissions: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: null
    },
    admin_title: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    account_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
      validate: {
        isIn: [['active', 'warned', 'suspended', 'blocked', 'deleted']]
      }
    },
    moderation_note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    moderation_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    warned_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    suspended_until: {
      type: DataTypes.DATE,
      allowNull: true
    },
    blocked_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    is_contributor: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    contributor_application_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'none'
    },
    contributor_application_note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    contributor_applied_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    contributor_approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    contributor_approved_by: {
      type: DataTypes.UUID,
      allowNull: true
    },
    primary_contact_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    profile_complete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    onboarding_step: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'PROFILE',
      validate: {
        isIn: [['PROFILE', 'PASSWORD', 'PLAN', 'PAYMENT', 'DONE']]
      }
    },
    selected_plan_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    plan_status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'none',
      validate: {
        isIn: [['none', 'pending_payment', 'active']]
      }
    },
    password_set: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    academic_last_progressed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    referral_code: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    invite_code: {
      type: DataTypes.STRING(20),
      allowNull: true,
      unique: true
    },
    referred_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true
    },
    country_code: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    phone_number: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    avatar_url: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    location: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    email_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    phone_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    last_active_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    current_plan: {
      type: DataTypes.STRING(100),
      defaultValue: 'Basic Student'
    },
    rewards_balance: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    rewards_pending: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    rewards_lifetime: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0
    },
    payout_contact: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    payout_telco: {
      type: DataTypes.STRING(40),
      allowNull: true
    },
    payout_contact_set_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    preferences: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    login_otp_hash: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    login_otp_challenge_token: {
      type: DataTypes.STRING(128),
      allowNull: true
    },
    login_otp_expires_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    login_otp_attempts: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    session_token: {
      type: DataTypes.STRING(128),
      allowNull: true
    }
  }, {
    tableName: 'users',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['auth_provider', 'provider_user_id']
      }
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password_hash) {
          user.password_hash = await bcrypt.hash(user.password_hash, 10);
        }
        if (!user.invite_code) {
          user.invite_code = crypto.randomBytes(4).toString('hex');
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password_hash')) {
          user.password_hash = await bcrypt.hash(user.password_hash, 10);
        }
      }
    }
  });

  User.prototype.verifyPassword = async function(password) {
    return await bcrypt.compare(password, this.password_hash);
  };

  User.prototype.toJSON = function() {
    const values = Object.assign({}, this.get());
    delete values.password_hash;
    delete values.session_token;
    delete values.login_otp_hash;
    delete values.login_otp_challenge_token;
    delete values.login_otp_expires_at;
    delete values.login_otp_attempts;
    return values;
  };

  User.associate = (models) => {
    if (models.UserContact) {
      User.belongsTo(models.UserContact, {
        foreignKey: 'primary_contact_id',
        as: 'primary_contact'
      });
      User.hasMany(models.UserContact, {
        foreignKey: 'user_id',
        as: 'contacts'
      });
    }

    User.belongsTo(models.Plan, {
      foreignKey: 'selected_plan_id',
      as: 'selected_plan'
    });


    if (models.AcademicProfile) {
      User.hasOne(models.AcademicProfile, {
        foreignKey: 'user_id',
        as: 'academic_profile'
      });
    }


    User.belongsTo(models.User, {
      foreignKey: 'referred_by_user_id',
      as: 'referrer'
    });
    
    User.hasMany(models.User, {
      foreignKey: 'referred_by_user_id',
      as: 'referrals'
    });
    
    User.hasOne(models.Subscription, {
      foreignKey: 'user_id',
      as: 'subscription'
    });
    
    User.hasOne(models.UserProgress, {
      foreignKey: 'user_id',
      as: 'progress'
    });
    
    User.hasMany(models.Lesson, { foreignKey: 'creator_id', as: 'created_lessons', constraints: false });
    User.hasMany(models.VideoLesson, { foreignKey: 'creator_id', as: 'created_video_lessons', constraints: false });
    User.hasMany(models.TextItem, { foreignKey: 'creator_id', as: 'created_text_items', constraints: false });
    
    User.hasMany(models.PLSItem, {
      foreignKey: 'user_id',
      as: 'pls_items'
    });
    
    User.hasMany(models.Contribution, {
      foreignKey: 'uploader_id',
      as: 'contributions'
    });

    if (models.RewardTransaction) {
      User.hasMany(models.RewardTransaction, {
        foreignKey: 'user_id',
        as: 'reward_transactions'
      });
    }

    if (models.RewardPayout) {
      User.hasMany(models.RewardPayout, {
        foreignKey: 'user_id',
        as: 'reward_payouts'
      });
    }

    if (models.PaymentTransaction) {
      User.hasMany(models.PaymentTransaction, {
        foreignKey: 'user_id',
        as: 'payment_transactions'
      });
    }

    if (models.Notification) {
      User.hasMany(models.Notification, {
        foreignKey: 'user_id',
        as: 'notifications'
      });
    }

    if (models.SupportReport) {
      User.hasMany(models.SupportReport, {
        foreignKey: 'user_id',
        as: 'support_reports'
      });
    }

    if (models.PushToken) {
      User.hasMany(models.PushToken, {
        foreignKey: 'user_id',
        as: 'push_tokens'
      });
    }

    if (models.CommunityPost) {
      User.hasMany(models.CommunityPost, {
        foreignKey: 'user_id',
        as: 'community_posts'
      });
    }

    if (models.CommunityReply) {
      User.hasMany(models.CommunityReply, {
        foreignKey: 'user_id',
        as: 'community_replies'
      });
    }

    if (models.ReferralDownload) {
      User.hasMany(models.ReferralDownload, {
        foreignKey: 'referrer_id',
        as: 'referral_downloads'
      });
    }

    if (models.AuthSession) {
      User.hasMany(models.AuthSession, {
        foreignKey: 'user_id',
        as: 'auth_sessions'
      });
    }

    if (models.StudyGroup) {
      User.hasMany(models.StudyGroup, {
        foreignKey: 'creator_user_id',
        as: 'created_study_groups'
      });
    }

    if (models.StudyGroupMember) {
      User.hasMany(models.StudyGroupMember, {
        foreignKey: 'user_id',
        as: 'study_group_memberships'
      });
    }

    if (models.StudyGroupMessage) {
      User.hasMany(models.StudyGroupMessage, {
        foreignKey: 'user_id',
        as: 'study_group_messages'
      });
    }
  };

  return User;
};
