//
// Created by Andrew Cheong on 5/6/22.
//

#ifndef INC_05___X1_2_MARKDOWN_TABLE_SCANNER_H
#define INC_05___X1_2_MARKDOWN_TABLE_SCANNER_H

#include <iostream>
#include <sstream>
#include <string>
#include <array>
#include <cpr/cpr.h>
#include <fstream>
#include <regex>
#include <map>
#include <vector>
#include <locale>

// trim from start (in place)
static inline void ltrim(std::string &s) {
    s.erase(s.begin(), std::find_if(s.begin(), s.end(), [](unsigned char ch) {
        return !std::isspace(ch);
    }));
}

// trim from end (in place)
static inline void rtrim(std::string &s) {
    s.erase(std::find_if(s.rbegin(), s.rend(), [](unsigned char ch) {
        return !std::isspace(ch);
    }).base(), s.end());
}

// trim from both ends (in place)
static inline void trim(std::string &s) {
    ltrim(s);
    rtrim(s);
}

class MarkdownTableScanner {
public:
    static std::vector<std::map<std::string, std::map<std::string, std::string> > > scan(std::string filepath) {

        static const std::regex MARKDOWN_TABLE_ROW("^\\s*[|](?:[^|]*[|])+\\s*$");

        std::vector<std::map<std::string, std::map<std::string, std::string> > > tables;

        std::ifstream filestream(filepath);
        if (filestream.is_open()) {

            std::cmatch what;
            std::string line;
            while (true) {

                std::map<std::string, std::map<std::string, std::string> > table;
                std::vector<std::string> table_headers;

                // consume lines until one matches the syntax of a table row
                bool table_found = false;
                while (std::getline(filestream, line)) {
                    if (std::regex_match(
                            line.c_str(),
                            what,
                            MARKDOWN_TABLE_ROW)) {
                        table_found = true;
                        break;
                    }
                }

                // found no table row syntax before EOF; done
                if (table_found == false) break;

                // assume table header row; extract table header values
                size_t last = 0;
                size_t next = 0;

                // skip 2 cols; if can't, not a valid table; continue scanning
                if ((next = line.find("|", last)) == std::string::npos) continue;
                last = next + 1;
                if ((next = line.find("|", last)) == std::string::npos) continue;
                last = next + 1;

                // parse table header cells
                while ((next = line.find("|", last)) != std::string::npos) {
                    std::string table_header = line.substr(last, next - last);
                    ltrim(table_header);
                    rtrim(table_header);
                    table_headers.push_back(table_header);
                    std::cout << "Found table header: " << table_header << std::endl;
                    last = next + 1;
                }

                // if didn't have col 3, wasn't a valid table; continue scanning
                if (table_headers.size() == 0) continue;

                // if no more lines, not a valid table and EOF; done
                if ((bool)std::getline(filestream, line) == false) break;

                // if next line isn't a table header separator row, invalid table; continue scanning
                if (std::regex_match(
                        line.c_str(),
                        what,
                        std::regex("^[|\\s-]+$")) == false) continue;

                // let's start parsing some actual data
                while (std::getline(filestream, line)) {
                    // no longer the table if table row syntax not matched; break to continue scanning
                    if (std::regex_match(
                            line.c_str(),
                            what,
                            MARKDOWN_TABLE_ROW) == false) break;

                    last = 0;
                    next = 0;

                    // skip 1 col; if can't, not a valid table; break to continue scanning
                    if ((next = line.find("|", last)) == std::string::npos) break;
                    last = next + 1;

                    // if doesn't have col 2, wasn't a valid table; break to continue scanning
                    if ((next = line.find("|", last)) == std::string::npos) break;

                    // assume row header; extract value
                    std::string row_header = line.substr(last, next - last);
                    ltrim(row_header);
                    rtrim(row_header);
                    last = next + 1;

                    // parse row cells
                    int cell_counter = 0;
                    while ((next = line.find("|", last)) != std::string::npos) {
                        std::string cell = line.substr(last, next - last);
                        ltrim(cell);
                        rtrim(cell);
                        // don't read more cols than table headers that were found
                        if (cell_counter >= table_headers.size()) break;
                        table[table_headers[cell_counter]][row_header] = cell;
                        std::cout << "table[" << table_headers[cell_counter] << "][" << row_header << "] = \"" << cell << "\"" << std::endl;
                        cell_counter++;
                        last = next + 1;
                    }
                }

                tables.emplace_back(table);
            }

            filestream.close();
        }

        return tables;
    }
};

#endif //INC_05___X1_2_MARKDOWN_TABLE_SCANNER_H
