import React, {Component} from 'react';
import {
  TouchableOpacity,
  Text,
  View
} from 'react-native';
import PropTypes from 'prop-types';

import styleConstructor from './style';

class Day extends Component {
  static propTypes = {
    // TODO: selected + disabled props should be removed
    state: PropTypes.oneOf(['selected', 'disabled', 'today', '']),

    // Specify theme properties to override specific styles for calendar parts. Default = {}
    theme: PropTypes.object,
    marked: PropTypes.any,
    onPress: PropTypes.func,
    markingExists: PropTypes.bool,
  };

  constructor(props) {
    super(props);
    this.style = styleConstructor(props.theme);
  }

  shouldComponentUpdate(nextProps) {
    return ['state', 'children', 'marked', 'onPress', 'markingExists'].reduce((prev, next) => {
      if (prev || nextProps[next] !== this.props[next]) {
        return true;
      }
      return prev;
    }, false);
  }

  render() {
    const containerStyle = [this.style.base];
    const textStyle = [this.style.text];

    let marked = this.props.marked || {};
    if (marked && marked.constructor === Array && marked.length) {
      marked = {
        marked: true
      };
    }

    if (marked.marked) {
      containerStyle.push(this.style.marked);
      textStyle.push(this.style.markedText);
    }

    // 已预约
    if (marked.appointed) {
      containerStyle.push(this.style.appointed);
      textStyle.push(this.style.appointedText);
    }

    if (this.props.state === 'selected' || marked.selected) {
      containerStyle.push(this.style.selected);
      textStyle.push(this.style.selectedText);
    } else if (this.props.state === 'disabled' || marked.disabled) {
      textStyle.push(this.style.disabledText);
    } else if (this.props.state === 'today') {
      textStyle.push(this.style.todayText);
    }

    // Leo: 拦截点击事件，disabled 不调用this.props.onPress
    const onPress = () => {
      if (this.props.state === 'disabled' || marked.disabled) {
        return;
      }
      this.props.onPress();
    };
    return (
      <TouchableOpacity style={containerStyle} onPress={onPress}>
        <Text style={textStyle}>{String(this.props.children)}</Text>
      </TouchableOpacity>
    );
  }
}

export default Day;
