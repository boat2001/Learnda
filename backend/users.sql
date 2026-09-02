-- users.sql
CREATE TYPE user_role AS ENUM ('student', 'lecturer', 'admin', 'contributor');
CREATE TYPE subscription_status AS ENUM ('active', 'pending', 'canceled', 'expired');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'student',
    institution_id UUID REFERENCES institutions(id) ON DELETE SET NULL,
    country_code VARCHAR(10),
    phone_number VARCHAR(20),
    avatar_url VARCHAR(500),
    -- bio TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    last_active_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    contact_email VARCHAR(255),
    contact_phone VARCHAR(20),
    -- website_url VARCHAR(500),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- plans.sql
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    billing_cycle VARCHAR(20) NOT NULL, -- 'monthly'
    version INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    max_pls_items INTEGER, -- NULL means unlimited
    max_contributions INTEGER, -- NULL means unlimited
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE plan_features (
    plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
    feature_key VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    config JSONB, -- Additional configuration for the feature
    PRIMARY KEY (plan_id, feature_key)
);

CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id),
    status subscription_status DEFAULT 'active',
    started_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    canceled_at TIMESTAMP,
    payment_method VARCHAR(50),
    payment_reference VARCHAR(255),
    next_billing_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- content.sql
CREATE TYPE content_type AS ENUM (
    'text_lesson',
    'video',
    'quiz',
    'blog',
    'illustration',
    'past_question',
    'edutainment'
);

CREATE TYPE depth_level AS ENUM ('basic', 'enhanced', 'advanced');
CREATE TYPE visual_type AS ENUM ('static', 'animated', 'interactive');
CREATE TYPE content_status AS ENUM ('draft', 'review', 'published', 'archived');
CREATE TYPE past_question_mode AS ENUM ('file', 'interactive', 'quiz_exam');

CREATE TABLE content_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    type content_type NOT NULL,
    depth_level depth_level DEFAULT 'basic',
    visual_type visual_type DEFAULT 'static',
    is_premium BOOLEAN DEFAULT FALSE,
    creator_id UUID REFERENCES users(id),
    status content_status DEFAULT 'draft',
    thumbnail_url VARCHAR(500),
    file_url VARCHAR(500),
    duration_minutes INTEGER,
    word_count INTEGER,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE content_metadata (
    content_id UUID PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
    course VARCHAR(100),
    topic VARCHAR(100),
    level VARCHAR(50),
    semester VARCHAR(20),
    subject VARCHAR(100),
    year INTEGER,
    institution_id UUID REFERENCES institutions(id),
    additional_metadata JSONB DEFAULT '{}'
);

CREATE TABLE past_question_modes (
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    mode past_question_mode NOT NULL,
    file_url VARCHAR(500),
    interactive_data JSONB,
    quiz_data JSONB,
    PRIMARY KEY (content_id, mode)
);

CREATE TABLE content_prerequisites (
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    prerequisite_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    PRIMARY KEY (content_id, prerequisite_id)
);

CREATE TABLE learning_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    creator_id UUID REFERENCES users(id),
    is_premium BOOLEAN DEFAULT FALSE,
    level VARCHAR(50),
    estimated_hours INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE learning_path_items (
    path_id UUID REFERENCES learning_paths(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    PRIMARY KEY (path_id, content_id)
);

-- PLS (Personal Learning Space).sql
CREATE TABLE pls_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    item_type VARCHAR(50) NOT NULL, -- 'course', 'file', 'folder', 'note', 'group'
    parent_id UUID REFERENCES pls_items(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    tags TEXT[] DEFAULT '{}',
    custom_order INTEGER DEFAULT 0,
    is_favorite BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, content_id, item_type)
);

CREATE TABLE pls_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pls_folder_items (
    folder_id UUID REFERENCES pls_folders(id) ON DELETE CASCADE,
    item_id UUID REFERENCES pls_items(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (folder_id, item_id)
);

CREATE TABLE study_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    creator_id UUID REFERENCES users(id),
    is_public BOOLEAN DEFAULT FALSE,
    max_members INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE study_group_members (
    group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- 'admin', 'moderator', 'member'
    joined_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);

CREATE TABLE study_group_content (
    group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (group_id, content_id)
);

-- Gamification.sql
CREATE TABLE user_progress (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak INTEGER DEFAULT 0,
    last_activity_date DATE,
    total_lessons_completed INTEGER DEFAULT 0,
    total_quizzes_taken INTEGER DEFAULT 0,
    total_contributions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    xp_reward INTEGER DEFAULT 0,
    criteria JSONB NOT NULL, -- {type: 'streak', value: 7}
    is_hidden BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_badges (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (user_id, badge_id)
);

CREATE TABLE leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'weekly', 'monthly', 'all_time'
    start_date DATE NOT NULL,
    end_date DATE,
    reset_period INTEGER, -- in days
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE leaderboard_entries (
    leaderboard_id UUID REFERENCES leaderboards(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    rank INTEGER,
    metadata JSONB DEFAULT '{}',
    PRIMARY KEY (leaderboard_id, user_id)
);

-- Analytics & Events.sql
CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    visitor_id UUID, -- For tracking visitors without accounts
    session_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB DEFAULT '{}',
    page_url VARCHAR(500),
    referrer_url VARCHAR(500),
    user_agent TEXT,
    ip_address INET,
    device_type VARCHAR(50),
    country VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE content_stats (
    content_id UUID PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE,
    total_views INTEGER DEFAULT 0,
    unique_viewers INTEGER DEFAULT 0,
    total_completions INTEGER DEFAULT 0,
    avg_time_spent INTEGER DEFAULT 0, -- in seconds
    completion_rate DECIMAL(5, 2) DEFAULT 0,
    rating_avg DECIMAL(3, 2) DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    save_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT NOW()
);

CREATE TABLE content_engagement (
    id BIGSERIAL PRIMARY KEY,
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'view', 'complete', 'like', 'save', 'share', 'comment'
    duration_seconds INTEGER,
    progress_percentage INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE user_learning_patterns (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferred_subjects TEXT[] DEFAULT '{}',
    preferred_content_types TEXT[] DEFAULT '{}',
    average_session_minutes INTEGER DEFAULT 0,
    peak_hours JSONB DEFAULT '{}',
    completion_rates JSONB DEFAULT '{}',
    last_analyzed TIMESTAMP DEFAULT NOW()
);

-- Contributions & Earnings.sql
CREATE TABLE contributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    contributor_id UUID REFERENCES users(id),
    contribution_type VARCHAR(50) NOT NULL,
    revenue_share INTEGER NOT NULL, -- percentage
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE content_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    period VARCHAR(20) NOT NULL, -- '2024-01', '2024-Q1'
    total_revenue DECIMAL(10, 2) DEFAULT 0,
    contributor_share DECIMAL(10, 2) DEFAULT 0,
    platform_share DECIMAL(10, 2) DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    unique_viewers_count INTEGER DEFAULT 0,
    completions_count INTEGER DEFAULT 0,
    calculated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(content_id, period)
);

CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    amount DECIMAL(10, 2) NOT NULL,
    period VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'paid', 'failed'
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payout_items (
    payout_id UUID REFERENCES payouts(id) ON DELETE CASCADE,
    earning_id UUID REFERENCES content_earnings(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    PRIMARY KEY (payout_id, earning_id)
);

-- Comments & Interactions.sql
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    like_count INTEGER DEFAULT 0,
    reply_count INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'hidden', 'deleted'
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE comment_likes (
    comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE content_likes (
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (content_id, user_id)
);

CREATE TABLE content_saves (
    content_id UUID REFERENCES content_items(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    folder_id UUID REFERENCES pls_folders(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (content_id, user_id)
);

-- Indexes for performance
CREATE INDEX idx_content_type_status ON content_items(type, status);
CREATE INDEX idx_content_creator ON content_items(creator_id);
CREATE INDEX idx_content_premium ON content_items(is_premium, status);
CREATE INDEX idx_user_subscriptions_user ON user_subscriptions(user_id, status, expires_at);
CREATE INDEX idx_events_user_event ON events(user_id, event_type);
CREATE INDEX idx_events_created ON events(created_at);
CREATE INDEX idx_content_engagement_user_content ON content_engagement(user_id, content_id);
CREATE INDEX idx_pls_user_content ON pls_items(user_id, content_id);
CREATE INDEX idx_user_progress_xp ON user_progress(xp DESC);
CREATE INDEX idx_leaderboard_scores ON leaderboard_entries(leaderboard_id, score DESC);
CREATE INDEX idx_contributions_contributor ON contributions(contributor_id, status);
