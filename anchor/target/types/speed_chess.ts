/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/speed_chess.json`.
 */
export type SpeedChess = {
  "address": "9z5kWJ5KSPfZXmCzv6cJyFXc6Y7tmsH5hj7SUy8aZji9",
  "metadata": {
    "name": "speedChess",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claimTimeoutWin",
      "discriminator": [
        175,
        234,
        101,
        151,
        53,
        30,
        177,
        137
      ],
      "accounts": [
        {
          "name": "chessMatch",
          "writable": true
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "initializeMatch",
      "discriminator": [
        156,
        133,
        52,
        179,
        176,
        29,
        64,
        124
      ],
      "accounts": [
        {
          "name": "chessMatch",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  104,
                  101,
                  115,
                  115,
                  95,
                  109,
                  97,
                  116,
                  99,
                  104
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "bettingTokenMint"
        },
        {
          "name": "playerTokenAccount",
          "writable": true
        },
        {
          "name": "matchTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "arg",
                "path": "matchId"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "matchId",
          "type": "string"
        },
        {
          "name": "betAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "joinMatch",
      "discriminator": [
        244,
        8,
        47,
        130,
        192,
        59,
        179,
        44
      ],
      "accounts": [
        {
          "name": "chessMatch",
          "writable": true
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "playerTokenAccount",
          "writable": true
        },
        {
          "name": "matchTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "chess_match.match_id",
                "account": "chessMatch"
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "betAmount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "makeMove",
      "discriminator": [
        78,
        77,
        152,
        203,
        222,
        211,
        208,
        233
      ],
      "accounts": [
        {
          "name": "chessMatch",
          "writable": true
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        },
        {
          "name": "matchTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  97,
                  116,
                  99,
                  104,
                  95,
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "chess_match.match_id",
                "account": "chessMatch"
              }
            ]
          }
        },
        {
          "name": "playerTokenAccount",
          "writable": true
        },
        {
          "name": "platformTokenAccount",
          "writable": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "fromRow",
          "type": "u8"
        },
        {
          "name": "fromCol",
          "type": "u8"
        },
        {
          "name": "toRow",
          "type": "u8"
        },
        {
          "name": "toCol",
          "type": "u8"
        },
        {
          "name": "promotion",
          "type": {
            "option": {
              "defined": {
                "name": "pieceType"
              }
            }
          }
        }
      ]
    },
    {
      "name": "resignGame",
      "discriminator": [
        43,
        29,
        143,
        188,
        152,
        151,
        136,
        19
      ],
      "accounts": [
        {
          "name": "chessMatch",
          "writable": true
        },
        {
          "name": "player",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "chessMatch",
      "discriminator": [
        72,
        241,
        122,
        67,
        252,
        229,
        79,
        237
      ]
    }
  ],
  "events": [
    {
      "name": "drawPayoutEvent",
      "discriminator": [
        204,
        185,
        220,
        244,
        158,
        169,
        10,
        187
      ]
    },
    {
      "name": "gameEndedEvent",
      "discriminator": [
        124,
        244,
        251,
        112,
        20,
        68,
        87,
        116
      ]
    },
    {
      "name": "matchCreatedEvent",
      "discriminator": [
        101,
        99,
        74,
        54,
        121,
        190,
        111,
        238
      ]
    },
    {
      "name": "moveMadeEvent",
      "discriminator": [
        116,
        181,
        208,
        158,
        192,
        84,
        32,
        251
      ]
    },
    {
      "name": "payoutEvent",
      "discriminator": [
        84,
        234,
        195,
        72,
        143,
        79,
        70,
        82
      ]
    },
    {
      "name": "playerJoinedEvent",
      "discriminator": [
        80,
        201,
        181,
        60,
        46,
        141,
        44,
        189
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "matchAlreadyFull",
      "msg": "The match is already full"
    },
    {
      "code": 6001,
      "name": "alreadyJoined",
      "msg": "You have already joined this match"
    },
    {
      "code": 6002,
      "name": "notYourTurn",
      "msg": "It's not your turn"
    },
    {
      "code": 6003,
      "name": "notOpponentsTurn",
      "msg": "It's not your opponent's turn"
    },
    {
      "code": 6004,
      "name": "notAPlayer",
      "msg": "You are not a player in this game"
    },
    {
      "code": 6005,
      "name": "invalidMove",
      "msg": "Invalid move"
    },
    {
      "code": 6006,
      "name": "gameNotActive",
      "msg": "The game is not active"
    },
    {
      "code": 6007,
      "name": "invalidBetAmount",
      "msg": "Invalid bet amount"
    },
    {
      "code": 6008,
      "name": "noOpponent",
      "msg": "No opponent has joined yet"
    },
    {
      "code": 6009,
      "name": "noWinner",
      "msg": "No winner has been determined"
    },
    {
      "code": 6010,
      "name": "opponentNotTimedOut",
      "msg": "Your opponent has not timed out yet"
    },
    {
      "code": 6011,
      "name": "invalidOwner",
      "msg": "The token account's owner does not match the player"
    },
    {
      "code": 6012,
      "name": "invalidMint",
      "msg": "The token account's mint does not match the provided mint"
    }
  ],
  "types": [
    {
      "name": "chessMatch",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "whitePlayer",
            "type": "pubkey"
          },
          {
            "name": "blackPlayer",
            "type": {
              "option": "pubkey"
            }
          },
          {
            "name": "currentTurn",
            "type": {
              "defined": {
                "name": "playerColor"
              }
            }
          },
          {
            "name": "whiteLastMoveTime",
            "type": "i64"
          },
          {
            "name": "blackLastMoveTime",
            "type": "i64"
          },
          {
            "name": "moveTimeout",
            "type": "i64"
          },
          {
            "name": "gameStatus",
            "type": {
              "defined": {
                "name": "gameStatus"
              }
            }
          },
          {
            "name": "board",
            "type": {
              "array": [
                {
                  "array": [
                    {
                      "option": {
                        "defined": {
                          "name": "piece"
                        }
                      }
                    },
                    8
                  ]
                },
                8
              ]
            }
          },
          {
            "name": "totalPot",
            "type": "u64"
          },
          {
            "name": "platformFeeBps",
            "type": "u16"
          },
          {
            "name": "bettingTokenMint",
            "type": "pubkey"
          }
        ]
      }
    },
    {
      "name": "drawPayoutEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "whitePlayer",
            "type": "pubkey"
          },
          {
            "name": "blackPlayer",
            "type": "pubkey"
          },
          {
            "name": "amountEach",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "gameEndReason",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "checkmate"
          },
          {
            "name": "stalemate"
          },
          {
            "name": "resignation"
          },
          {
            "name": "timeout"
          },
          {
            "name": "agreement"
          }
        ]
      }
    },
    {
      "name": "gameEndedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "winner",
            "type": {
              "option": {
                "defined": {
                  "name": "playerColor"
                }
              }
            }
          },
          {
            "name": "reason",
            "type": {
              "defined": {
                "name": "gameEndReason"
              }
            }
          }
        ]
      }
    },
    {
      "name": "gameStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "waitingForOpponent"
          },
          {
            "name": "active"
          },
          {
            "name": "whiteWin"
          },
          {
            "name": "blackWin"
          },
          {
            "name": "draw"
          }
        ]
      }
    },
    {
      "name": "matchCreatedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "betAmount",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "moveMadeEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "color",
            "type": {
              "defined": {
                "name": "playerColor"
              }
            }
          },
          {
            "name": "algebraicMove",
            "type": "string"
          },
          {
            "name": "fromRow",
            "type": "u8"
          },
          {
            "name": "fromCol",
            "type": "u8"
          },
          {
            "name": "toRow",
            "type": "u8"
          },
          {
            "name": "toCol",
            "type": "u8"
          },
          {
            "name": "promotion",
            "type": {
              "option": {
                "defined": {
                  "name": "pieceType"
                }
              }
            }
          }
        ]
      }
    },
    {
      "name": "payoutEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "winner",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "fee",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "piece",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "pieceType",
            "type": {
              "defined": {
                "name": "pieceType"
              }
            }
          },
          {
            "name": "color",
            "type": {
              "defined": {
                "name": "playerColor"
              }
            }
          }
        ]
      }
    },
    {
      "name": "pieceType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "pawn"
          },
          {
            "name": "knight"
          },
          {
            "name": "bishop"
          },
          {
            "name": "rook"
          },
          {
            "name": "queen"
          },
          {
            "name": "king"
          }
        ]
      }
    },
    {
      "name": "playerColor",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "white"
          },
          {
            "name": "black"
          }
        ]
      }
    },
    {
      "name": "playerJoinedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "matchId",
            "type": "string"
          },
          {
            "name": "player",
            "type": "pubkey"
          },
          {
            "name": "color",
            "type": {
              "defined": {
                "name": "playerColor"
              }
            }
          }
        ]
      }
    }
  ]
};
