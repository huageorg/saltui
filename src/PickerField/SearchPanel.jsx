/**
 * PickerField Component for tingle
 * @author longyan
 *
 * Copyright 2014-2016, Tingle Team.
 * All rights reserved.
 */
import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import IconCheck from 'salt-icon/lib/Check';
import IconCheckRound from 'salt-icon/lib/CheckRound';
import Promise from 'lie';
import NattyFetch from 'natty-fetch/dist/natty-fetch';
import Context from '../Context';
import ScrollView from '../ScrollView';
import Button from '../Button';
import Popup from '../Popup';
import SearchBar from '../SearchBar';
import SearchResult from './SearchResult';
import GroupingBar from './GroupingBar';
import utils from './utils';

class SearchPanel extends React.Component {
  static renderSearchTips() {
    return <div />;
  }

  constructor(props) {
    super(props);
    const t = this;
    const { value } = props;
    t.state = {
      value: value || [],
      results: [],
      openResults: [],
      searchMode: false,
      searchEmpty: false,
      isOpenSearch: false,
      hasKeyword: false,
      popupVisible: false,
    };
    t.delaySearch = utils.debounce(t.search.bind(t), t.props.searchDelay);
    t.handleLeaveResultView = t.handleLeaveResultView.bind(t);
    t.groupEl = {};
  }

  componentDidMount() {
    const t = this;
    if (t.props.fetchDataOnOpen) {
      t.delaySearch('');
      t.setState({
        isOpenSearch: true,
      });
    }
  }

  search(term) {
    const t = this;
    if (t.fetch) {
      t.fetch.abort();
      if (t.state.isOpenSearch) {
        t.setState({
          isOpenSearch: false,
        });
      }
    }
    if (t.props.fetchUrl) {
      t.fetch = NattyFetch.create({
        url: t.props.fetchUrl,
        jsonp: t.props.dataType ? t.props.dataType === 'jsonp' : (/\.jsonp/.test(t.props.fetchUrl)),
        data: t.props.beforeFetch({ q: term }),
        fit: t.props.fitResponse,
        Promise,
      });
      t.fetch().then((data) => {
        const fetchData = t.props.afterFetch(data);
        t.setData(fetchData);
      }).catch((e) => {
        console.error(e); // eslint-disable-line no-console
      });
    } else {
      const options = t.props.options || [];
      if (!t.searchIndex) {
        const processFunc = t => {
          const phonetic = utils.getPhonetic(t);
          return [
            t.toLowerCase(),
            phonetic.join('').toLowerCase(),
            phonetic.map(str => (str[0] || '')).join('').toLowerCase()
          ];
        };
        t.searchIndex = options.map(item => ({
          indexes: processFunc(item.text),
          item
        }));
      }
      const filteredData = term ?
        t.searchIndex.filter(entity => {
          return entity.indexes.some(indexText => indexText.indexOf(term.toLowerCase()) > -1)
        }).map(entity => entity.item) :
        options
      t.setData(filteredData);
    }
  }

  setData(fetchData) {
    const t = this;
    const state = {};
    if (fetchData && fetchData.length) {
      state.searchEmpty = false;
    } else {
      state.searchEmpty = true;
    }
    if (t.props.grouping) {
      const groups = {};
      fetchData.sort((a, b) => {
        const phoneticA = utils.getPhonetic(a.text);
        const phoneticB = utils.getPhonetic(b.text);
        let compare = 0;
        phoneticA.some((string, i) => {
          if (!phoneticB[i] || string > phoneticB[i]) {
            compare = 1;
            return true;
          } else if (string < phoneticB[i]) {
            compare = -1;
            return true;
          }
        });
        return compare;
      });
      fetchData.forEach(item => {
        let group = (utils.getPhonetic(item.text[0] || '#')[0] || '#')[0].toUpperCase();
        if (group < 'A' || group > 'Z') {
          group = '#';
        }
        groups[group] = groups[group] || [];
        groups[group].push(item);
      });
      fetchData = Object.keys(groups).sort((a, b) => {
        return utils.alphabet.indexOf(a) - utils.alphabet.indexOf(b)
      }).map(key => ({
        title: key,
        items: groups[key]
      }));
    }
    if (t.state.isOpenSearch) {
      state.openResults = fetchData;
      state.isOpenSearch = false;
    } else {
      state.results = state.searchEmpty ? [] : fetchData;
    }
    t.setState(state);
  }

  handleItemClick(item) {
    const t = this;

    if (t.props.multiple) {
      const { value } = this.state;

      let found = -1;
      value.some((v, i) => {
        if (v.value === item.value) {
          found = i;
          return true;
        }
        return false;
      });

      if (found > -1) {
        value.splice(found, 1);
        t.setState({
          value,
        });
      } else {
        t.setState({
          value: [...value, item],
        });
      }
    } else {
      t.setState({
        value: [item],
      }, () => {
        t.handleConfirm();
      });
    }
  }

  handleSearchChange(term) {
    const t = this;

    if (term) {
      t.delaySearch(term);
      t.setState({
        hasKeyword: true,
        results: [],
      });
    } else {
      // abort exists fetch request
      if (t.fetch) {
        t.fetch.abort();
      }
      t.setState({
        hasKeyword: false,
        results: [],
      });
    }
  }

  handleSearchEnter() {
    const t = this;
    t.setState({
      searchMode: true,
    });
  }

  handleSearchLeave() {
    const t = this;
    t.setState({
      searchMode: false,
    });
  }

  handleConfirm() {
    this.props.onConfirm(this.state.value);
  }

  handleEnterResultView() {
    this.setState({
      popupVisible: true,
    }, () => {
      window.history.pushState({
        PickerField: 'SearchPanel.result',
      }, '', utils.addUrlParam('PICKER', Date.now()));

      window.addEventListener('popstate', this.handleLeaveResultView, false);
    });
  }

  handleLeaveResultView(e) {
    const { state } = e;
    if (state && state.PickerField === 'SearchPanel.index') {
      window.removeEventListener('popstate', this.handleLeaveResultView, false);
      this.setState({
        popupVisible: false,
      });
    }
  }

  isItemChecked(item) {
    const t = this;
    let found = -1;
    t.state.value.forEach((v, i) => {
      if (v.value === item.value) {
        found = i;
      }
    });
    return found > -1;
  }

  selectGrouping(key) {
    const t = this;
    let element = t.groupEl[key];
    if (element) {
      element.scrollIntoView();
    }
  }

  isEmpty() {
    return this.state.value.length === 0;
  }

  renderEmpty() {
    const t = this;
    return (
      <div className={Context.prefixClass('picker-field-search-empty')}>
        <div className={Context.prefixClass('picker-field-search-empty-inner')}>{t.props.searchNotFoundContent}</div>
      </div>
    );
  }

  renderResults(results) {
    const t = this;
    return (
      <div className={Context.prefixClass('picker-field-search-results')}>
        {t.props.grouping ?
          t.renderGroups(results) :
          results.map((item, index) => t.renderResultItem(item, index))
        }
      </div>
    );
  }

  renderGroups(groups) {
    const t = this;
    return (
      groups.map((group, index) => {
        return (
          <div
            className={Context.prefixClass('picker-field-grouping')}
            key={group.title}
            ref={ref => { t.groupEl[group.title] = ref }}
          >
            <div className={Context.prefixClass('picker-field-grouping-title')}>
              <p className={Context.prefixClass('picker-field-grouping-title-inner')}>{group.title}</p>
            </div>
            {group.items.map((item, index) => t.renderResultItem(item, index))}
          </div>
        )
      })
    )
  }

  renderResultItem(item, index) {
    const t = this;

    const checked = t.isItemChecked(item);
    let iconHTML;
    if (t.props.multiple) {
      iconHTML = (
        <IconCheckRound
          className={classnames({
            'un-checked': !checked,
          })}
          width={20}
          height={20}
        />
      );
    } else if (checked) {
      iconHTML = (
        <IconCheck
          width={14}
          height={14}
        />
      );
    }

    return (
      <div
        key={index}
        className={classnames(Context.prefixClass('picker-field-search-result-item'), t.props.noIcon ? Context.prefixClass('picker-field-no-icon') : null, Context.prefixClass('clear'))}
        onClick={() => {
          t.handleItemClick(item);
        }}
      >
        {t.props.noIcon ? null :
          <span className={Context.prefixClass('picker-field-search-result-item-icon')}>
            {iconHTML}
          </span>
        }
        <span className={classnames(Context.prefixClass('picker-field-search-result-item-entry'), t.props.noIcon ? Context.prefixClass('picker-field-no-icon') : null)}>{t.props.formatter(item)}</span>
      </div>
    );
  }

  renderResultCondition() {
    const t = this;
    if (t.state.hasKeyword) {
      if (t.state.searchEmpty) {
        return t.renderEmpty();
      }
      return t.renderResults(t.state.results);
    } else if (t.props.fetchDataOnOpen && t.state.openResults.length) {
      return t.renderResults(t.state.openResults);
    }
    return SearchPanel.renderSearchTips();
  }

  renderGroupingBar() {
    const t = this;
    let groups = [];
    if (t.state.hasKeyword) {
      groups = t.state.results;
    } else if (t.props.fetchDataOnOpen && t.state.openResults.length) {
      groups = t.state.openResults;
    }
    const keys = groups.map(group => group.title);
    return (
      <GroupingBar
        keys={keys}
        onSelect={t.selectGrouping.bind(t)}
      />
    )
  }

  render() {
    const t = this;
    const {
      showSearch,
      multiple,
    } = t.props;
    const pageSize = utils.getPageSize();
    const { length } = this.state.value;
    const resultProps = {
      value: [...this.state.value],
      confirmText: this.props.confirmText,
      onConfirm: (value) => {
        this.setState({
          value,
        }, () => {
          window.history.go(-1);
        });
      },
      formatter: this.props.formatter,
      selectText: this.props.selectText,
    };
    return (
      <div
        className={classnames(Context.prefixClass('picker-field-searchpanel'), {
          multiple,
        })}
        style={{
          width: `${pageSize.width}px`,
          height: `${pageSize.height}px`,
        }}
      >
        <div className={Context.prefixClass('picker-field-searchpanel-inner')}>
          {showSearch ? (
            <div className={Context.prefixClass('picker-field-searchpanel-header')}>
              <SearchBar
                ref={(c) => {
                  t.searchBar = c;
                }}
                searchText={t.props.searchText}
                cancelText={t.props.cancelText}
                className={Context.prefixClass('picker-field-searchpanel-search')}
                onChange={(val) => {
                  t.handleSearchChange(val);
                }}
                onEnterSearchMode={() => {
                  t.handleSearchEnter();
                }}
                onLeaveSearchMode={() => {
                  t.handleSearchLeave();
                }}
              />
            </div>
          ) : null}
          <div className={Context.prefixClass('picker-field-searchpanel-content')}>
            <ScrollView bounce={false} disablePointer>
              {t.renderResultCondition()}
            </ScrollView>
            {t.props.grouping ? t.renderGroupingBar() : null}
          </div>
          {multiple ? (
            <div className={Context.prefixClass('picker-field-searchpanel-footer')}>
              <Button
                className={Context.prefixClass('picker-field-searchpanel-btn-ok')}
                size="small"
                display="inline"
                disabled={t.isEmpty()}
                onClick={(e) => {
                  t.handleConfirm(e);
                }}
              >{t.props.confirmText}
              </Button>
              <div
                className={Context.prefixClass('picker-field-searchpanel-result-summary')}
                onClick={(e) => {
                  t.handleEnterResultView(e);
                }}
              >
                <a href="javacript:;">{t.props.selectText}{length}</a>
              </div>
            </div>
          ) : null}
        </div>
        <Popup content={<SearchResult {...resultProps} />} animationType="slide-left" visible={this.state.popupVisible} />
      </div>
    );
  }
}

SearchPanel.defaultProps = {
  onConfirm() {},
  showSearch: true,
  multiple: false,
  value: undefined,
  searchText: undefined,
  confirmText: undefined,
  cancelText: undefined,
  fetchDataOnOpen: undefined,
  dataType: undefined,
  beforeFetch: undefined,
  fitResponse: undefined,
  afterFetch: undefined,
  searchTitle: undefined,
  searchDelay: undefined,
  searchPlaceholder: undefined,
  searchNotFoundContent: undefined,
  formatter: undefined,
  selectText: undefined,
};

// http://facebook.github.io/react/docs/reusable-components.html
SearchPanel.propTypes = {
  value: PropTypes.array,
  searchText: PropTypes.string,
  confirmText: PropTypes.string,
  cancelText: PropTypes.string,
  onConfirm: PropTypes.func,
  options: PropTypes.array,
  fetchUrl: PropTypes.string,
  fetchDataOnOpen: PropTypes.bool,
  dataType: PropTypes.string,
  beforeFetch: PropTypes.func,
  fitResponse: PropTypes.func,
  afterFetch: PropTypes.func,
  showSearch: PropTypes.bool,
  searchTitle: PropTypes.string,
  searchDelay: PropTypes.number,
  searchPlaceholder: PropTypes.string,
  searchNotFoundContent: PropTypes.string,
  formatter: PropTypes.func,
  multiple: PropTypes.bool,
  grouping: PropTypes.bool,  
  noIcon: PropTypes.bool,  
  selectText: PropTypes.string,
};

SearchPanel.displayName = 'SearchPanel';

export default SearchPanel;
