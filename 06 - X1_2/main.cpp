#include <iostream>
#include "authorized_rest_client.h"
#include "authorized_rest_client_config.h"
#include "markdown_table_scanner.h"

static std::string get_or_default(strmap map, std::string key) {
    auto it = map.find(key);
    if (it != map.end()) return it->second;
    std::cout << "WARNING! Can't find " << key << " in configuration." << std::endl;
    return "";
}

int main() {

    auto tables = MarkdownTableScanner::scan("../exchange_specs.md");

    for (const auto& [spec, exchange_to_value] : tables[1]) {
        for (const auto& [exchange, value] : exchange_to_value) {
            tables[0][exchange][spec] = value;
        }
    }

    for (const auto& [spec, exchange_to_value] : tables[2]) {
        for (const auto& [exchange, value] : exchange_to_value) {
            tables[0][exchange][spec] = value;
        }
    }

    for (const auto& [spec, exchange_to_value] : tables[3]) {
        for (const auto& [exchange, value] : exchange_to_value) {
            tables[0][exchange][spec] = value;
        }
    }

    for (const auto& [spec, exchange_to_value] : tables[4]) {
        for (const auto& [exchange, value] : exchange_to_value) {
            tables[0][exchange][spec] = value;
        }
    }

    for (const auto& [exchange, spec_to_value] : tables[0]) {
        auto default_unset = [](std::string a) { return a.empty() ? "UNSET" : a; };
        AuthorizedRestClientConfig config{

                .api_domain = get_or_default(spec_to_value, "api_domain"),
                .api_base_path = get_or_default(spec_to_value, "api_base_path"),
                .api_version = get_or_default(spec_to_value, "api_version"),
                .api_url_formatter = get_or_default(spec_to_value, "api_url_formatter"),
                .api_key = get_or_default(spec_to_value, "api_key"),
                .api_key_formatter = get_or_default(spec_to_value, "api_key_formatter"),

                .secret_key = get_or_default(spec_to_value, "secret_key"),
                .secret_key_encoding = Encoding::_from_string(default_unset(get_or_default(spec_to_value, "secret_key_encoding")).c_str()),
                .unsigned_msg_formatter = get_or_default(spec_to_value, "unsigned_msg_formatter"),
                .signer = Signer::_from_string(default_unset(get_or_default(spec_to_value, "signer")).c_str()),

                .required_query_api_key_param = get_or_default(spec_to_value, "required_query_api_key_param"),
                .required_query_timestamp_param = get_or_default(spec_to_value, "required_query_timestamp_param"),
                .required_query_timestamp_format = TimestampFormat::_from_string(default_unset(get_or_default(spec_to_value, "required_query_timestamp_format")).c_str()),
                .required_query_signed_msg_param = get_or_default(spec_to_value, "required_query_signed_msg_param"),

                .required_header_api_key_key = get_or_default(spec_to_value, "required_header_api_key_key"),
                .required_header_api_version_key = get_or_default(spec_to_value, "required_header_api_version_key"),
                .required_header_api_version_value = get_or_default(spec_to_value, "required_header_api_version_value"),
                .required_header_timestamp_key = get_or_default(spec_to_value, "required_header_timestamp_key"),
                .required_header_timestamp_format = TimestampFormat::_from_string(default_unset(get_or_default(spec_to_value, "required_header_timestamp_format")).c_str()),
                .required_header_api_signed_msg_key = get_or_default(spec_to_value, "required_header_api_signed_msg_key"),
                .required_header_passphrase_key = get_or_default(spec_to_value, "required_header_passphrase_key"),
                .required_header_passphrase_value = get_or_default(spec_to_value, "required_header_passphrase_value"),
                .required_header_passphrase_signer = Signer::_from_string(default_unset(get_or_default(spec_to_value, "required_header_passphrase_signer")).c_str()),
                .required_header_passphrase_encoding = Encoding::_from_string(default_unset(get_or_default(spec_to_value, "required_header_passphrase_encoding")).c_str()),
        };
        if (exchange == "binance.us") {
            (new AuthorizedRestClient(config))->send("GET", "/account");
        } else if (exchange == "pro.coinbase.com") {
            (new AuthorizedRestClient(config))->send("GET", "/accounts");
        } else if (exchange == "kucoin.com") {
            (new AuthorizedRestClient(config))->send("GET", "/accounts");
        }
    }

    return 0;
}
