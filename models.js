// get sequelize package
var Sequelize = require('sequelize')

// connect to postgres db on heroku - define timestamps makes sure sequelize doesnt change our model
var sequelize = new Sequelize(process.env.DB_CONNECTION, {define:{timestamps: false}})

// define models in DB
var User = sequelize.define('users', {
  username: {
    type: Sequelize.STRING,
  },
  password: {
    type: Sequelize.STRING
  },
  trainer: {
	  type: Sequelize.BOOLEAN
  }
})

var Lesson = sequelize.define('lessons', {
  title: {
    type: Sequelize.STRING,
  },
  content: {
    type: Sequelize.STRING
  }
})

var Course = sequelize.define('courses', {
  title: {
    type: Sequelize.STRING,
  },
  content: {
    type: Sequelize.STRING
  }
})

var Course_Lesson = sequelize.define('course_lessons', {
	lesson_id: {
		type: Sequelize.INTEGER
	},
	course_id: {
		type: Sequelize.INTEGER
	},
	lesson_title: {
		type: Sequelize.STRING
	}
})

var Course_User = sequelize.define('course_users', {
	course_id: {
		type: Sequelize.INTEGER
	},
	user_id: {
		type: Sequelize.INTEGER
	},
	course_title: {
		type: Sequelize.STRING
	}
})


// export for app.js
exports.User = User
exports.Lesson = Lesson
exports.Course = Course
exports.Course_Lesson = Course_Lesson
exports.Course_User = Course_User
exports.sequelize = sequelize