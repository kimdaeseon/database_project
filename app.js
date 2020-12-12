var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var session = require('express-session')
var FileStore = require('session-file-store')(session)
var oracledb = require('oracledb')
var authRouter = require('./routes/auth');
var usersRouter = require('./routes/users');
const { setegid } = require('process');

var app = express();
var config = {
  user: "project",
  password: "1234",
  connectString: "localhost/orcl.docker.internal"
}
function doRelease(connection) {
  connection.release(function (err) {
    if (err) {
      console.error(err.message);
    }
  });
}
function takenClassList(connection, req) {
  return new Promise(function (resolve, reject) {
    connection.execute(`select trim(l.lecture_name), trim(l.lecture_type), trim(l.lecture_credit) from lecture l where l.lecture_name in ( select t.lecture_name from taken_class t where t.student_number = ${req.session.studentNumber} )`, [], function (err, result) {
      if (err) {
        console.error(err.message);
        doRelease(connection);
      }
      let taken_lecture = ''
      for (let i = 0; i < result.rows.length; i++) {
        taken_lecture += '<tr>'
        taken_lecture += '<td>' + result.rows[i][0] + '</td>'
        taken_lecture += '<td>' + result.rows[i][1] + '</td>'
        taken_lecture += '<td>' + result.rows[i][2] + '</td>'
        taken_lecture += '</tr>'
      }
      resolve(taken_lecture)
    });
  })
}
function makeList(connection, req) {
  return new Promise(function (resolve, reject) {
    connection.execute(`select trim(l.lecture_name), trim(l.lecture_type), trim(l.lecture_credit) from lecture l where l.lecture_name in ( select w.lecture_name from will_take_class w minus SELECT t.lecture_name from taken_class t where t.student_number = ${req.session.studentNumber} )`, [], function (err, result) {
      if (err) {
        console.error(err.message);
        doRelease(connection);
      }
      let will_take_lecture = ''
      for (let i = 0; i < result.rows.length; i++) {
        will_take_lecture += '<tr>'
        will_take_lecture += '<td>' + result.rows[i][0] + '</td>'
        will_take_lecture += '<td>' + result.rows[i][1] + '</td>'
        will_take_lecture += '<td>' + result.rows[i][2] + '</td>'
        will_take_lecture += '</tr>'
      }
      resolve(will_take_lecture)
    });
  })
}
function calcRequireCredit(connection, req) {
  return new Promise(function (resolve, reject) {
    year = parseInt(req.session.studentNumber / 1000000)
    console.log(year)
    connection.execute(`select selective_major_credit, essential_major_credit, total_mahor_credit from major where admission_year = ${year} and major_name = (select major_name from member where student_number = ${req.session.studentNumber})`, [], function (err, result) {
      if (err) {
        console.error(err.message);
        doRelease(connection);
      }
      let taken_credit = ''
      taken_credit += '<tr>'
      taken_credit += '<td>' + result.rows[0][0] + '</td>'
      taken_credit += '<td>' + result.rows[0][1] + '</td>'
      taken_credit += '<td>' + result.rows[0][2] + '</td>'
      taken_credit += '</tr>'
      resolve(taken_credit)
    });
  })
}
function calcTakenCredit(connection, req) {
  return new Promise(function (resolve, reject) {
    connection.execute(`select sum(decode(trim(l.lecture_type), '전공선택', lecture_credit)),sum(decode(trim(l.lecture_type), '전공필수', lecture_credit)),sum(l.lecture_credit) from taken_class t, lecture l where t.student_number = ${req.session.studentNumber} and t.lecture_name = l.lecture_name`, [], function (err, result) {
      if (err) {
        console.error(err.message);
        doRelease(connection);
      }
      let taken_credit = ''
      taken_credit += '<tr>'
      taken_credit += '<td>' + result.rows[0][0] + '</td>'
      taken_credit += '<td>' + result.rows[0][1] + '</td>'
      taken_credit += '<td>' + result.rows[0][2] + '</td>'
      taken_credit += '</tr>'
      resolve(taken_credit)
    });
  })
}
function renderHtml(req) {
  return new Promise(function (resolve, reject) {
    oracledb.getConnection(config, async (err, connection) => {
      if (err) {
        console.error(err.message);
      }
      let taken_class = await takenClassList(connection, req)
      let will_take_lecture = await makeList(connection, req)
      let require_credit = await calcRequireCredit(connection, req)
      let taken_credit = await calcTakenCredit(connection, req)
      result = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>test</title>
                <link rel="stylesheet" href="/stylesheets/style.css">
                <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.2/css/bootstrap.min.css">
                <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.2/css/bootstrap-theme.min.css">
                <script src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
                <script src="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.2/js/bootstrap.min.js"></script>
            </head>
            <body>
                <h2 style="text-align:center; padding-top:100px;">졸업할 수 있겠조?</h2>
                <div style="float:right; padding-right:400px">
                  <form action="/auth/logout" method="post">
                    <input type="submit" value="logout">
                  </form>
                </div>
                <div class="table-alli">
                <h4>수강한 강의 입력</h4>
                <form action="/auth/insert", method="post">
                  <div class = "insertt" >강의명</div>
                  <br>
                  <div class = "insertt" ><input type="text" name = "lecture_name"></input></div>
                  <br>
                  <input type="submit" style="margin:10px"></input>
                </form>
                </br></br></br></br><h4>수강해야 하는 강의 목록</h4>
                    <table class ="table table-bordered">
                        <thead>
                            <tr>
                                <th class ="numbers" style="text-align:center">과목명</th>
                                <th id = "listTitle" style="text-align:center">과목종류</th>
                                <th id = "listTitle" style="text-align:center">학점</th>
                            </tr>
                        </thead>
                        <tbody id ="listTarget">
                                ${will_take_lecture}
                        </tbody>
                    </table>
                </br></br></br></br><h4>이수학점</h4>
                    <table class ="table table-bordered">
                      <thead>
                          <tr>
                              <th class ="numbers" style="text-align:center">전공선택</th>
                              <th id = "listTitle" style="text-align:center">전공필수</th>
                              <th id = "listTitle" style="text-align:center">총 이수 학점</th>
                          </tr>
                      </thead>

                      <tbody id ="listTarget">
                        ${taken_credit}
                      </tbody>
                  </table>
                  </br></br></br></br><h4>요구학점</h4>
                    <table class ="table table-bordered">
                      <thead>
                          <tr>
                              <th class ="numbers" style="text-align:center">전공선택</th>
                              <th id = "listTitle" style="text-align:center">전공필수</th>
                              <th id = "listTitle" style="text-align:center">총 이수 학점</th>
                          </tr>
                      </thead>
                      <tbody id ="listTarget">
                      ${require_credit}
                      </tbody>
                  </table>
                  </br></br></br></br><h4>수강한 강의 목록</h4>
                    <table class ="table table-bordered">
                        <thead>
                            <tr>
                                <th class ="numbers" style="text-align:center">과목명</th>
                                <th id = "listTitle" style="text-align:center">과목종류</th>
                                <th id = "listTitle" style="text-align:center">학점</th>
                            </tr>
                        </thead>
                        <tbody id ="listTarget">
                                ${will_take_lecture}
                        </tbody>
                    </table>
                </div>
            </body>
            </html>
                `
      resolve(result)
    });
  })

}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'qweasdsfsdf@#%@#%!dasdzxczx',
  resave: false,
  saveUninitialized: true,
  store: new FileStore()
}))
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname + "/views/login.html"))
})
app.get('/main', async (req, res) => {
  // res.sendFile(path.join(__dirname + "/views/main.html"))
  if (req.session.is_logined != true) {
    res.redirect('/')
    return;
  }
  result = await renderHtml(req)
  res.end(result)
})

app.use('/auth', authRouter);
app.use('/users', usersRouter);



// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
