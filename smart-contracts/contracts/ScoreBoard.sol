//frontend/smart-contracts/contracts/ScoreBoard.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ScoreBoard {
    // tournamentId => player => score
    mapping(uint256 => mapping(address => uint16)) private _scores;

    // simple list of players we recorded per tournament so we can iterate
    mapping(uint256 => address[]) private _players;

    event ScoreStored(uint256 indexed tournamentId,
                      address indexed player,
                      uint16 score);

    /// Only the backend wallet is allowed to write.
    address public owner;
    modifier onlyOwner() {
        require(msg.sender == owner, "not authorised");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function recordScore(
        uint256 tournamentId,
        address player,
        uint16 score
    ) external onlyOwner {
        if (_scores[tournamentId][player] == 0) {
            _players[tournamentId].push(player);
        }
        _scores[tournamentId][player] = score;
        emit ScoreStored(tournamentId, player, score);
    }

    function getScore(
        uint256 tournamentId,
        address player
    ) external view returns (uint16) {
        return _scores[tournamentId][player];
    }

    function listPlayers(
        uint256 tournamentId
    ) external view returns (address[] memory) {
        return _players[tournamentId];
    }
}
