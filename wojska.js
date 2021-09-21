(() => {
  const COORDS_REGEXP = /\d{3}\|\d{3}/g;

  const domParser = new DOMParser();
  const troops = [];
  const groups = [];

  fetch('https://' + game_data.world + '.plemiona.pl/game.php?screen=overview_villages&mode=units&group=0')
    .then(res => res.text())
    .then(res => loadTroopsFromResponse(res))
    .then(() => loadTroopsDuringTraining())
    .then(() => loadSnobsDuringTraining())
    .then(() => drawWindow());


  const loadTroopsFromResponse = res => {
    const doc = domParser.parseFromString(res, 'text/html');

    if (!mobile) groups.push({ name: 'wszystkie', id: 0 });
    const groupElementTag = mobile ? 'option' : 'a';
    doc.querySelectorAll('#paged_view_content .vis_item ' + groupElementTag).forEach(
      group => {
        let groupName, groupId;
        if (!mobile) {
          groupName = group.innerText.replace('[', '').replace(']', '');
          groupId = group.getAttribute('data-group-id');
        } else {
          groupName = group.innerText;
          const groupStartIndex = group.value.search('group=') + 6;
          const groupEndIndex = group.value.slice(groupStartIndex).search('&') + groupStartIndex;
          groupId = group.value.slice(groupStartIndex, groupEndIndex);
        }
        groups.push(
          {
            name: groupName,
            id: +groupId
          }
        );
      }
    );

    doc.querySelectorAll('#units_table .row_marker').forEach(v => {
      const ownTroops = v.children[0].querySelectorAll('.unit-item');
      const insideTroops = v.children[1].querySelectorAll('.unit-item');
      const outsideTroops = v.children[2].querySelectorAll('.unit-item');
      const travellingTroops = v.children[3].querySelectorAll('.unit-item');

      const coordsTab = v.children[0].querySelector('.quickedit-vn').innerText.match(COORDS_REGEXP);
      const id = +v.children[0].querySelector('.quickedit-vn').getAttribute('data-id');
      const villageOverviewLink = v.children[0].querySelector('.quickedit-content a');

      const troopsObject = {
        coords: coordsTab[coordsTab.length - 1],
        villageId: id,
        overviewLink: villageOverviewLink,
        ownTroops: {},
        insideTroops: {},
        outsideTroops: {},
        travellingTroops: {},
        duringTraining: {},
        output: {}
      };

      game_data.units.forEach((unit, index) => {
        troopsObject.ownTroops[unit] = +ownTroops[index].innerText;
        troopsObject.output[unit] = +ownTroops[index].innerText;
        troopsObject.insideTroops[unit] = +insideTroops[index].innerText;
        troopsObject.outsideTroops[unit] = +outsideTroops[index].innerText;
        troopsObject.travellingTroops[unit] = +travellingTroops[index].innerText;
      });

      troops.push(troopsObject);
    });
  };

  const loadTroopsDuringTraining = () => fetch('https://' + game_data.world + '.plemiona.pl/game.php?screen=train&mode=mass')
    .then(res => res.text())
    .then(txt => domParser.parseFromString(txt, 'text/html'))
    .then(htmlDoc => {
      troops.forEach(tr => {
        game_data.units.forEach(unit => {
          const unitsDuringTraining = htmlDoc.querySelector('#' + unit + '_' + tr.villageId)?.getAttribute('data-running') ?? 0;
          tr.duringTraining[unit] = +unitsDuringTraining;
        });
      });
    });

  const loadSnobsDuringTraining = () => fetch('https://' + game_data.world + '.plemiona.pl/game.php?screen=overview_villages&mode=prod')
    .then(res => res.text())
    .then(txt => domParser.parseFromString(txt, 'text/html'))
    .then(htmlDoc => {
      let idTab;
      if (mobile)
        idTab = Array.from(htmlDoc.querySelectorAll('.quickedit-vn')).map(element => element.getAttribute('data-id'));
      htmlDoc.querySelectorAll('#production_table tr.nowrap').forEach((row, index) => {
        const cells = row.querySelectorAll('td');
        const id = mobile ? idTab[index] : cells[1].querySelector('span').getAttribute('data-id');
        const snobs = Array.from(cells[cells.length - 1].querySelectorAll('.queue_icon img'))
          .filter(img => img.title.includes('Szlachcic')).length;
        troops.find(t => t.villageId == id).duringTraining.snob = snobs;
      });
    });

  const getGroupVillages = groupId =>
    fetch('https://' + game_data.world + '.plemiona.pl/game.php?screen=overview_villages&mode=units&group=' + groupId)
      .then(response => response.text())
      .then(txt => domParser.parseFromString(txt, 'text/html'))
      .then(htmlDoc => Array.from(htmlDoc.querySelectorAll('#units_table .quickedit-vn'))
        .map(element => +element.getAttribute('data-id')));

  const drawWindow = () => {
    let tableRows = '';
    let groupsOptions = '';
    let unitsColumns = '';
    const unitImgBase = 'https://dspl.innogamescdn.com/asset/c6bd6037/graphic/unit/unit_';

    groups.forEach(group => groupsOptions += `<option value="${group.id}">${group.name}</option>`);

    game_data.units.forEach(unit =>
      unitsColumns += `
              <th style="cursor:pointer" class="unit-column" id="${unit}-column">
                  <img src="${unitImgBase + unit}.png">
              </th>
              `);

    troops.forEach(village => {
      let villageTroops = '';
      game_data.units.forEach(unit => villageTroops += '<td>' + village.output[unit] + '</td>');
      tableRows +=
        `<tr data-village-id="${village.villageId}">
                  <td><input type="checkbox"></td>
                  <td>
                      <a href="${village.overviewLink}">
                          ${village.overviewLink.querySelector('.quickedit-label').innerText.trim()}
                      </a>
                  </td>
                  ${villageTroops}
              </tr>
              `;
    });

    const troopsWindowBase =
      `<div class="popup_box_container">
              <div class="popup_box show">
                  <div class="popup_box_content">
                      <a class="popup_box_close" style="cursor: pointer"></a>
                      <div id="troops-table-container">
                          <button class="btn" id="mark-off">Zaznacz OFF</button>
                          <button class="btn" id="mark-deff">Zaznacz DEFF</button>
                          Grupa: <select id="group-select">${groupsOptions}</select><br>
                          Uwzględnij wojska: 
                          <input type="radio" id="own-troops-radio" name="inside-troops" value="own" checked>własne
                          <input type="radio" id="all-troops-radio" name="inside-troops" value="all">w wiosce
                          <input type="checkbox" id="outside-troops-checkbox">poza wioską
                          <input type="checkbox" id="travelling-troops-checkbox">w drodze
                          <input type="checkbox" id="during-training-troops-checkbox">w rekrutacji
                          <div class="vis vis_item">
                              <table style="width: 100%" id="troops-table">
                                  <thead>
                                      <tr>
                                          <th><input type="checkbox" id="all-troops-checkbox"></th>
                                          <th><span class="icon header village"></span></th>
                                          ${unitsColumns}
                                      </tr>
                                  </thead>
                                  <tbody>
                                      ${tableRows}
                                  </tbody>
                              </table>
                          </div>
                          <button class="btn" id="export-csv-button">Eksportuj CSV</button>
                          <button class="btn" id="export-json-button">Eksportuj JSON</button>
                      </div>
                  </div>
              </div>
              <div class="fader"></div>
          </div>`;
    const troopsWindow = domParser.parseFromString(troopsWindowBase, 'text/html');

    const offUnits = ['axe', 'light', 'marcher', 'ram', 'catapult', 'snob'];
    const deffUnits = ['spear', 'sword', 'archer', 'heavy', 'knight'];

    troopsWindow.querySelectorAll('.unit-column').forEach(column => column.addEventListener('click', fadeColumn));
    troopsWindow.querySelector('#group-select').addEventListener('change', switchGroup);
    troopsWindow.querySelector('#mark-off').addEventListener('click', () => markUnits(offUnits));
    troopsWindow.querySelector('#mark-deff').addEventListener('click', () => markUnits(deffUnits));
    troopsWindow.querySelector('#export-csv-button').addEventListener('click', () => exportTroops(exportCSV));
    troopsWindow.querySelector('#export-json-button').addEventListener('click', () => exportTroops(exportJSON));
    troopsWindow.querySelector('#own-troops-radio').addEventListener('change', ownTroopsRadioClicked);
    troopsWindow.querySelector('#all-troops-radio').addEventListener('change', allTroopsRadioClicked);
    troopsWindow.querySelector('#outside-troops-checkbox').addEventListener('click', outsideTroopsCheckboxClicked);
    troopsWindow.querySelector('#travelling-troops-checkbox').addEventListener('click', travellingTroopsChcekboxClicked);
    troopsWindow.querySelector('#all-troops-checkbox').addEventListener('click', allTroopsChcekboxClicked);
    troopsWindow.querySelector('#during-training-troops-checkbox').addEventListener('click', duringTrainingTroopsCheckboxClicked);
    troopsWindow.querySelector('.popup_box_close').addEventListener('click', closeWindow);
    if (mobile) troopsWindow.querySelector('#group-select').value = 0;

    document.body.appendChild(troopsWindow.body.firstChild);
  };

  const fadeColumn = function () {
    if (this.classList.contains('faded')) this.classList.remove('faded')
    else this.classList.add('faded');
  };

  const ownTroopsRadioClicked = () => {
    troops.forEach(village =>
      game_data.units.forEach(unit => {
        village.output[unit] -= village.insideTroops[unit];
        village.output[unit] += village.ownTroops[unit];
      })
    );
    redrawTableRows();
  };

  const allTroopsRadioClicked = () => {
    troops.forEach(village =>
      game_data.units.forEach(unit => {
        village.output[unit] += village.insideTroops[unit];
        village.output[unit] -= village.ownTroops[unit];
      })
    );
    redrawTableRows();
  };

  const outsideTroopsCheckboxClicked = function () {
    if (this.checked) troops.forEach(village =>
      game_data.units.forEach(unit => village.output[unit] += village.outsideTroops[unit])
    );
    else troops.forEach(village =>
      game_data.units.forEach(unit => village.output[unit] -= village.outsideTroops[unit])
    );
    redrawTableRows();
  };

  const travellingTroopsChcekboxClicked = function () {
    if (this.checked) troops.forEach(village =>
      game_data.units.forEach(unit => village.output[unit] += village.travellingTroops[unit])
    );
    else troops.forEach(village =>
      game_data.units.forEach(unit => village.output[unit] -= village.travellingTroops[unit])
    );
    redrawTableRows();
  };

  const allTroopsChcekboxClicked = function () {
    document.querySelectorAll('#troops-table tbody tr input')
      .forEach(checkbox => checkbox.checked = this.checked);
  };

  const duringTrainingTroopsCheckboxClicked = function () {
    if (this.checked) troops.forEach(village =>
      game_data.units.forEach(unit => village.output[unit] += village.duringTraining[unit])
    );
    else troops.forEach(village =>
      game_data.units.forEach(unit => village.output[unit] -= village.duringTraining[unit])
    );
    redrawTableRows();
  }

  const redrawTableRows = () => document.querySelectorAll('#troops-table tbody tr').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    const villageId = tr.getAttribute('data-village-id');
    const villageTroops = troops.find(t => t.villageId == villageId);
    game_data.units.forEach((unit, index) => { cells[2 + index].innerText = villageTroops.output[unit] });
  });

  const switchGroup = () => {
    const groupId = document.querySelector('#group-select').value;
    getGroupVillages(groupId).then(groupVillages => {
      document.querySelectorAll('#troops-table tbody tr').forEach(tr => {
        if (!groupVillages.includes(+tr.getAttribute('data-village-id')))
          tr.setAttribute('hidden', null);
        else
          tr.removeAttribute('hidden');
      });
    });
  };

  const markUnits = unitsTab => game_data.units.forEach(unit => {
    const column = document.querySelector('#' + unit + '-column');
    if (unitsTab.includes(unit)) column.classList.remove('faded');
    else column.classList.add('faded');
  });

  const getMarkedUnits = () => game_data.units.filter(unit => !document.querySelector('#' + unit + '-column').classList.contains('faded'));

  const getMarkedTroops = () => {
    const markedUnits = getMarkedUnits();
    const markedVillages = Array.from(document.querySelectorAll('#troops-table tbody tr'))
      .filter(tr => !tr.hidden && tr.querySelector('input').checked)
      .map(tr => +tr.getAttribute('data-village-id'));

    return markedVillages.map(villageId => {
      const village = troops.find(t => t.villageId === villageId);
      const troopsOject = {
        coords: village.coords,
        troops: {}
      };
      markedUnits.forEach(unit => troopsOject.troops[unit] = village.output[unit]);
      return troopsOject;
    });
  };

  const exportCSV = () => {
    const troopsArray = getMarkedTroops();
    const markedUnits = getMarkedUnits();
    let csv = '';

    troopsArray.forEach(troopsObject => {
      csv += troopsObject.coords + ',';
      for (const [index, unit] of markedUnits.entries()) {
        csv += troopsObject.troops[unit];
        csv += index < markedUnits.length - 1 ? ',' : '';
      }
      csv += '\n';
    });

    return csv;
  };

  const exportJSON = () => JSON.stringify(getMarkedTroops());

  const exportTroops = (exportFunction) => document.querySelector('#troops-table-container').innerHTML =
    `<textarea style="width: 300px; height: 300px">${exportFunction()}</textarea>`;

  const closeWindow = () => document.querySelector('.popup_box_container').remove();
})();
