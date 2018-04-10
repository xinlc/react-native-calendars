import React, { PropTypes } from 'react';
import { View, StyleSheet } from 'react-native';
import { Flex, Text, WingBlank, Button, Modal } from 'antd-mobile-cyq';
import { connect } from 'react-redux';
import moment from 'moment';
import { CalendarList, LocaleConfig } from '../src';
import Day from '../src/calendar/day/cyq';
import Utils from '../../Lib/Utils';
import AlertMessage from '../Lib/AlertMessage';
import { fetchWorkintDays, deleteCalendar } from '../Actions/workingDays';
import { updateJobField } from '../Actions/hourlyWorker';

LocaleConfig.locales['zh'] = {
  monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
  monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
  dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
  dayNamesShort: ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
};

LocaleConfig.defaultLocale = 'zh';

const DAYS = 20;
/**
 * 我/TA 的时间表
 */
class WorkingDays extends React.Component {

  static defaultProps = {
    isMe: false,
    userProfileId: 0,
    userId: 0
  };

  static contextTypes = {
    routes: PropTypes.object,
  };

  constructor(props, context) {
    super(props);
    this.Actions = context.routes;
    if (props.isMe) this.Actions.refresh({ title: '我的时间表', rightTitle: '多选' });
    this._msgid = Utils.generateUUID();
    this._markedDates = {}; // 存放用户设置过的状态, {'2017-08-18': { marked: true, appointed: false, selected: false, calendarId: '20320170817', bookUserId: '' }}
    this._switchToRadio = false; // 全部设置后自动切换到单选模式标识
    this.state = {
      markedDates: this._initMarkedDates(),
      multiSelect: false,
      showMarkedFlag: false,
      showAppointedFlag: false,
    };
  }

  componentDidMount() {
    this._fetchWorkingDays();
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.pressRightMenu != nextProps.pressRightMenu && this.props.isMe) {
      if (this.state.multiSelect) {
        this.Actions.refresh({ rightTitle: '多选' });
        this.setState({ multiSelect: false, markedDates: this._initMarkedDates() });
      } else {
        this.Actions.refresh({ rightTitle: '单选' });
        this.setState({ multiSelect: true });
      }
    }

    if (this.props.refresh != nextProps.refresh) {
      this._fetchWorkingDays();

      // 全部设置后，切换到单选模式
      if (this._switchToRadio) {
        this._switchToRadio = false;
        setTimeout(() => {
          this.Actions.refresh({ rightTitle: '多选' });
          this.setState({ multiSelect: false, markedDates: this._initMarkedDates() });
        }, 2000);
      }
    }
  }

  _fetchWorkingDays() {
    const userId = this.props.isMe ? undefined : this.props.userProfileId;
    this.props.dispatch(fetchWorkintDays(this._msgid, userId, (res) => {
      // "sdate": "2017-08-17",
      // "status": 1,
      // "calendarId": "20320170817",
      // "bookUserId": ""
      const dates = {};
      for (const n of res) {
        dates[`${n.sdate}`] = { calendarId: n.calendarId, bookUserId: n.bookUserId };
        this._conversionStatus(n, dates[`${n.sdate}`]);
      }
      this._markedDates = dates;
      this.setState({ markedDates: this._initMarkedDates() });
    }));
  }

  _conversionStatus(n, date) {
    switch (n.status) {
    case 1:     // 已设置
      date.marked = true;
      if (!this.state.showMarkedFlag) this.setState({ showMarkedFlag: true });
      break;
    case 2:     // 已预约
      // 不是自己预约，禁用
      if (this.props.isMe || this.props.userId == n.bookUserId) {
        date.appointed = true;
        if (!this.state.showAppointedFlag) this.setState({ showAppointedFlag: true });
      } else {
        date.disabled = true;
      }
      break;
    default:
    }
  }

  _initMarkedDates() {
    // const initDates = {
    //   '2017-08-18': { marked: true },
    //   '2017-08-21': { appointed: true },
    // };

    const initDates = this._markedDates;

    // 查看TA，禁用TA未设置的天数
    if (!this.props.isMe) {
      let i = 0;
      while (i <= DAYS) {
        const key = moment().add(i, 'd').format('YYYY-MM-DD');
        if (initDates[key] == undefined) {
          initDates[key] = {
            disabled: true
          };
        }
        i++;
      }
    }

    return Utils.deepCopy(initDates);
  }

  _openAppointment(day) {
    const cd = this.state.markedDates[day.dateString];

    // 获取可预约日期
    const days = [];
    const calendarIds = {};
    Object.entries(this.state.markedDates).map((n) => {
      if (n[1].marked || n[1].appointed) {
        days.push(n[0]);
        calendarIds[n[0]] = n[1].calendarId;
      }
      return null;
    });
    const options = { calendarId: cd.calendarId, day: day.dateString, calendarIds, days, targetUserID: `${this.props.userProfileId}` };
    this.props.openAppointment(options);
  }


  _onDayPress(day) {
    if (!this.props.isMe) {
      this._openAppointment(day);
      return;
    }

    // 自己操作，去设置工作时间
    if (this.state.multiSelect == false) {
      let calendarId = null;
      let bookUserId = null;
      if (this._markedDates[day.dateString]) {
        calendarId = this._markedDates[day.dateString].calendarId || null;
        bookUserId = this._markedDates[day.dateString].bookUserId || null;
      }
      this.props.openSetWorkingTime({ day: day.dateString, calendarIds: [calendarId], bookUserId });
      return;
    }

    // 多选
    const markedDates = this.state.markedDates;
    const markday = markedDates[day.dateString];

    // 已预约不能批量操作
    if (markday && markday.appointed) return;

    // 选中
    if (markday) {
      if (markday.selected) {
        markedDates[day.dateString].selected = false;
      } else {
        markedDates[day.dateString].selected = true;
      }
    } else {
      markedDates[day.dateString] = { selected: true };
    }
    this.setState({ markedDates: { ...markedDates } });
  }

  // 批量操作
  _setWorkingDays() {
    const markedDates = this.state.markedDates;
    const selectedDates = [];
    const calendarIds = [];
    for (const [k, v] of Object.entries(markedDates)) {
      if (v.selected) {
        selectedDates.push(k);

        // 获取calendarId
        if (this._markedDates[k] && this._markedDates[k].calendarId) {
          calendarIds.push(this._markedDates[k].calendarId);
        }
      }
    }

    if (selectedDates.length <= 0) {
      Utils.toast('请先点选需要设置的日期哦');
      return;
    }

    let day = '';
    if (selectedDates.length > 1) {
      day = [...selectedDates];
    } else {
      day = selectedDates[0];
    }
    this._switchToRadio = true;
    this.props.openSetWorkingTime({ day, calendarIds });
  }

  _deleteAll() {
    const markedDates = this.state.markedDates;
    const calendarIds = [];
    let hasSelected = false;
    for (const [k, v] of Object.entries(markedDates)) {
      if (v.selected) {
        // 获取calendarId
        if (this._markedDates[k] && this._markedDates[k].calendarId) {
          calendarIds.push(this._markedDates[k].calendarId);
        }

        if (!hasSelected) hasSelected = true;
      }
    }

    if (calendarIds.length <= 0) {
      let msg = '请先点选需要删除的日期哦';
      if (hasSelected) {
        msg = '删除成功';
        this.props.dispatch(updateJobField('workingDay.refresh', Date.now()));
      }
      Utils.toast(msg);
      return;
    }

    Modal.alert('提示', '确定删除吗？', [
      { text: '取消', onPress: () => console.log('cancel') },
      { text: '确定', onPress: () => { // eslint-disable-line
        this.props.dispatch(deleteCalendar(this._msgid, calendarIds, () => {
          Utils.toast('删除成功');
          this.props.dispatch(updateJobField('workingDay.refresh', Date.now()));
        }));
      } },
    ]);
  }

  render() {
    return (
      <View style={{ flex: 1, backgroundColor: '#f3f3f3' }}>
        <Flex style={{ backgroundColor: '#fff', padding: 5 }}>
          <Flex.Item>
            <Text>* 最多{this.props.isMe ? '设置' : '显示'}最近三周的安排</Text>
          </Flex.Item>
          <Flex style={{ padding: 10, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f3f3' }}>
            { this.state.showMarkedFlag ? (<View style={{ width: 15, height: 15, borderRadius: 7.5, backgroundColor: '#97d470' }} />) : null }
            { this.state.showMarkedFlag ? (<Text> { this.props.isMe ? '空闲' : '可预约' }</Text>) : null }
            <WingBlank size="sm" />
            { this.state.showAppointedFlag ? (<View style={{ width: 15, height: 15, borderRadius: 7.5, backgroundColor: '#fb7c61' }} />) : null }
            { this.state.showAppointedFlag ? (<Text> { this.props.isMe ? '有约' : '已预约' }</Text>) : null }
          </Flex>
        </Flex>
        <CalendarList
          // Initially visible month. Default = Date()
          // current={moment().format('YYYY-MM-DD')}
          // Minimum date that can be selected, dates before minDate will be grayed out. Default = undefined
          minDate={moment().format('YYYY-MM-DD')}
          // Maximum date that can be selected, dates after maxDate will be grayed out. Default = undefined
          maxDate={moment().add(DAYS, 'd').format('YYYY-MM-DD')}
          // Handler which gets executed on day press. Default = undefined
          onDayPress={day => this._onDayPress(day)}
          // Month format in calendar title. Formatting values: http://arshaw.com/xdate/#Formatting
          monthFormat={'M月'}
          // Handler which gets executed when visible month changes in calendar. Default = undefined
          onMonthChange={(month) => { console.log('month changed', month); }}
          // Hide month navigation arrows. Default = false
          hideArrows={false}
          // Replace default arrows with custom ones (direction can be 'left' or 'right')
          // renderArrow={(direction) => (<Arrow />)}
          // Do not show days of other months in month page. Default = false
          hideExtraDays
          // If hideArrows=false and hideExtraDays=false do not swich month when tapping on greyed out
          // day from another month that is visible in calendar page. Default = false
          disableMonthChange
          // If firstDay=1 week starts from Monday. Note that dayNames and dayNamesShort should still start from Sunday.
          firstDay={0}

          // Callback which gets executed when visible months change in scroll view. Default = undefined
          onVisibleMonthsChange={(months) => { console.log('now these months are visible', months); }}
          // Max amount of months allowed to scroll to the past. Default = 50
          pastScrollRange={0}
          // Max amount of months allowed to scroll to the . Default = 50
          futureScrollRange={1}
          // Enable or disable scrolling of calendar list
          scrollEnabled

          markedDates={this.state.markedDates}
          renderDay={Day}
        />
        {
          this.state.multiSelect ? (
            <Flex style={{ borderTopWidth: 1, borderTopColor: '#f3f3f3', backgroundColor: '#fff', paddingVertical: 8 }}>
              <Flex.Item>
                <WingBlank>
                  <Button size="small" type="primary" onClick={() => this._setWorkingDays()}>全部设置</Button>
                </WingBlank>
              </Flex.Item>
              <Flex.Item>
                <WingBlank>
                  <Button size="small" type="ghost" onClick={() => this._deleteAll()}>全部删除</Button>
                </WingBlank>
              </Flex.Item>
            </Flex>
          ) : null
        }
        <AlertMessage msgid={this._msgid} />
      </View>
    );
  }
}

const Styles = StyleSheet.create({
  hr: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f3f3'
  },
  footerBtn: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#fcd000',
    backgroundColor: '#fcd000'
  },
});

function mapStateToProps(state) {
  return {
    userId: state.reduxUser.userid,
    refresh: state.hourly['workingDay.refresh']
  };
}
export default connect(mapStateToProps)(WorkingDays);
