const Nightmare = require('nightmare');
let _isLatestPage;
let _currentPage;
let _currentBoard = 'Gossiping';
let _boardsRequireOver18 = ['Gossiping', 'sex'];
let _intervalId = setInterval(() => crawlPosts(_currentBoard), 1000);

crawlHotBoards();

function crawlHotBoards() {
    const url = 'https://www.ptt.cc/bbs/hotboards.html';
    const nightmare = Nightmare({ show: false, electronPath: require('electron').remote.app.getPath('exe') });
    nightmare.goto(url)
        .inject('js', 'jquery-3.3.1.min.js')
        .wait('.b-ent')
        .evaluate(() => {
            const bents = $('.b-ent');
            const list = bents.map((index, item) => {
                $bent = $(item);
                const $nuser = $bent.find('.board-nuser span');
                const $title = $bent.find('.board-title');
                const $class = $bent.find('.board-class');
                const $name = $bent.find('.board-name');
                return {
                    nuser: { n: $nuser.text(), type: $nuser.attr('class') },
                    title: $title.text(),
                    class: $class.text(),
                    name: $name.text()
                };
            }).get();
            return {
                list
            }
        })
        .end()
        .then(initDrowdownMenu)
        .catch(error => {
            console.error('Search failed:', error);
        });
}

function initDrowdownMenu(res) {
    res.list.forEach((item, index) => {
        const type = typeMapping(item.nuser.type);
        const $a = $(`<a data-board='${item.name}' class='dropdown-item' href='#'>${item.title}</a>`)
            .prepend(`<span class='badge badge-pill badge-${type}'>${item.nuser.n}</span>`)
            .prepend($(`<span class='badge badge-pill badge-info'>${item.class}</span>`))
            .prepend($(`<span class='badge badge-dark' style='width:100px;'>${item.name}</span>`));
        $('.dropdown-menu').append($a);
    });

    $(`<a href='#' class='not-found-message dropdown-item'>not found...</a>`)
        .appendTo('.dropdown-menu')
        .hide();
}

function crawlPosts(board, page) {
    const url = `https://www.ptt.cc/bbs/${board}/index${(page ? page : '')}.html`;
    const nightmare = Nightmare({ show: false, electronPath: require('electron').remote.app.getPath('exe') });

    let nightmareChainingTemp = nightmare.goto(url);
    if (_boardsRequireOver18.indexOf(board) >= 0) {
        nightmareChainingTemp = nightmareChainingTemp.click('.btn-big');
    }
    nightmareChainingTemp.inject('js', 'jquery-3.3.1.min.js')
        .wait('.r-ent')
        .evaluate(() => {
            const previousPageUrl = $('.btn-group-paging a:nth-child(2)')
                .attr('href');
            const currentPage = parseInt(
                previousPageUrl
                    .substring(previousPageUrl.lastIndexOf('/'))
                    .replace('/index', '')
                    .replace('.html', '')
            ) + 1;
            const currentBoard = previousPageUrl.split('/')[2];
            const isLatestPage = $('.btn-group-paging a:nth-child(3)')
                .hasClass('disabled');

            let rents = isLatestPage ? $('.r-list-sep').prevAll() : $('.r-ent');

            const list = rents.map((index, item) => {
                const $rent = $(item);
                const $nrec = $rent.find('.nrec span');
                const $title = $rent.find('.title a');
                const $meta = $rent.find('.meta');
                return {
                    nrec: { n: $nrec.text(), type: $nrec.attr('class') },
                    title: $title.text(),
                    href: `https://www.ptt.cc${$title.attr('href')}`,
                    date: $meta.find('.date').text().trim(),
                    author: $meta.find('.author').text()
                };
            }).get().filter((v) => v.title);
            return {
                list: isLatestPage ? list : list.reverse(),
                currentPage,
                isLatestPage,
                currentBoard
            }
        })
        .end()
        .then(render)
        .catch(error => {
            console.error('Search failed:', error);
        });
}

function loading(on) {
    if (on) {
        $('.reload').addClass('loading');
    } else {
        $('.reload').removeClass('loading');
    }
}

function render(result) {
    _currentPage = result.currentPage;
    _isLatestPage = result.isLatestPage;
    _currentBoard = result.currentBoard;
    const $currentPage = $('.current-page');
    if ($currentPage.text() != result.currentPage) {
        loading(false);
        $currentPage.text(result.currentPage);
    }

    if (result.isLatestPage) {
        $('.go-next-page').hide();
    } else {
        $('.go-next-page').show();
    }

    result.list.reverse().forEach((item, index) => {
        let $post = findPost(item);
        if ($post.length == 0) {
            $post = createPost(item);
            $post.hide().prependTo('.list-group').fadeIn('slow');
        } else {
            updatePost($post, item);
        }
    });
}

function typeMapping(nrecType) {
    let type = 'light';
    switch (nrecType) {
        case 'hl f0':
            type = 'dark';
            break;
        case 'hl f1':
            type = 'danger';
            break;
        case 'hl f2':
            type = 'success';
            break;
        case 'hl f3':
            type = "warning";
            break;
        case 'hl f4':
        case 'hl f5':
        case 'hl f6':
            type = "primary";
            break;
    }
    return type;
}

function createPost(postInfo) {
    const type = typeMapping(postInfo.nrec.type);
    const $content = $(`<div class='d-flex w-100 justify-content-between'></div>`)
        .append($(`<h5>${postInfo.title}</h5>`))
        .append($(`<small>${postInfo.date}</small>`));
    return $(`<a class='list-group-item list-group-item-action list-group-item-${type} flex-column align-items-start' onclick='browserOpen(this);return false;'></a>`)
        .attr('href', postInfo.href)
        .append($content)
        .append($(`<span class='badge badge-light nrecn' style='margin-right:10px;'>${postInfo.nrec.n}</span>`))
        .append($(`<small>${postInfo.author}</small>`))
        .append($(`<small style='float:right;'>p.${_currentPage}</small>`))
        .append($(`<span class='badge badge-dark' style='float:right;margin-right:10px;'>${_currentBoard}</span>`));
}

function findPost(item) {
    return $(`[href='${item.href}']`);
}

function updatePost($post, item) {
    const type = typeMapping(item.nrec.type);
    if (!$post.hasClass(`list-group-item-${type}`)) {
        $post
            .removeClass('list-group-item-dark list-group-item-success list-group-item-warning list-group-item-primary list-group-item-light list-group-item-danger')
            .addClass(`list-group-item-${type}`);
    }

    const $nrecn = $post.find(".nrecn")
    if ($nrecn.text() != item.nrec.n) {
        $nrecn.text(item.nrec.n).hide().fadeIn("slow");
    }
}

function clearPosts() {
    $('.list-group a').remove();
}

function changePage(board, page) {
    loading(true);
    clearInterval(_intervalId);
    clearPosts();
    _currentPage = page;
    _intervalId = setInterval(() => crawlPosts(board, page), 1000);
}

function toggleDropdown(expand) {
    if (expand) {
        $(".dropdown-menu").addClass('show');
    } else {
        $(".dropdown-menu").removeClass('show');
    }
}

$(".go-next-page").click(() => changePage(_currentBoard, _currentPage + 1));
$(".go-prev-page").click(() => changePage(_currentBoard, _currentPage - 1));
$(".reload").click(() => { if (!_isLatestPage) changePage(_currentBoard); });

$('.dropdown-filter').keyup((e) => {
    $('a.not-found-message').hide();
    toggleDropdown(true);
    const input = $(e.target).val().toLowerCase();
    $('.dropdown-menu a').show();
    let found = false;
    $.each($('.dropdown-menu a'), (index, item) => {
        const $option = $(item);
        if ($option.text().toLowerCase().indexOf(input) == -1) {
            $option.hide();
        } else {
            found = true;
        }
    });

    if (!found) {
        $("a.not-found-message").show();
    }
});

$('.dropdown-menu').on('click', '.dropdown-item', (e) => {
    const $this = $(e.target);
    let board = $this.data('board');
    if (!board) {
        board = $this.parent('a').data('board');
    }
    $('.dropdown-filter').val(board);
    toggleDropdown(false);
});

$('.go').click(() => {
    const board = $('.dropdown-filter').val();
    changePage(board);
});