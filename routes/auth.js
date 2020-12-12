var express = require('express');
var oracledb = require('oracledb')
const { request, response } = require('../app');
var router = express.Router();
oracledb.autoCommit = true;

var config = {
    user: "project",
    password: "1234",
    connectString: "localhost/orcl.docker.internal"
}

function doRelease(connection) {
    connection.release(function (err) {
        if (err) {
            console.error(err.message);
            console.log("KKK")
        }
    });
}


router.post('/insert', function (req, res) {
    console.log("해위 ^^")
    const post = req.body
    const name = post.lecture_name
    const type = post.lecture_type
    console.log(name, type)

    oracledb.getConnection(config, (err, connection) => {
        if (err) {
            console.error(err.message);
            return;
        }
        connection.execute(`insert into taken_class values(${req.session.studentNumber}, '${name}')`, function (err, result) {
            if (err) {
                console.error(err.message);
                res.redirect('/main')
                return;
            }
            console.log(result.rows);  //데이터
            doRelease(connection)
            res.redirect('/main')
            return
        });
    });
})
router.post('/logout', function (req, res) {
    req.session.destroy(function (err) {
        if (err) {
            console.log(err.message)
        }
    })
    res.redirect('/')
})
/* GET home page. */
router.post('/login', function (req, res, next) {
    console.log("이까진 왔습네다")
    const post = req.body
    const id = post.id
    const pwd = post.pwd

    oracledb.getConnection(config, (err, connection) => {
        if (err) {
            console.error(err.message);
            console.log("GGG")
            return;
        }
        connection.execute("select * from member", {}, { outFormat: oracledb.OBJECT }, function (err, result) {
            if (err) {
                console.error(err.message);
                console.log("BBB")
                doRelease(connection);
                return;
            }
            doRelease(connection)
            console.log(result.rows);  //데이터
            for (i of result.rows) {
                console.log(i["STUDENT_NUMBER"], i["MEMBER_PWD"].trim())
                if (i["STUDENT_NUMBER"] == id && i["MEMBER_PWD"].replace(/^\s+|\s+$/gm, '') === pwd) {
                    req.session.is_logined = true
                    req.session.studentNumber = i["STUDENT_NUMBER"]
                    res.redirect('/main')
                    return
                }
            }

            res.send('failed')
            return
        });
    });
});



module.exports = router;
