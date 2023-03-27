//
// Created by Andrew Cheong on 5/22/22.
//

#ifndef INC_08___X1_4_STRTOKM_H
#define INC_08___X1_4_STRTOKM_H

/**
 * https://stackoverflow.com/a/29848367/925913
 */
char *strtokm(char *str, const char *delim)
{
    static char *tok;
    static char *next;
    char *m;

    if (delim == NULL) return NULL;

    tok = (str) ? str : next;
    if (tok == NULL) return NULL;

    m = strstr(tok, delim);

    if (m) {
        next = m + strlen(delim);
        *m = '\0';
    } else {
        next = NULL;
    }

    return tok;
}

#endif //INC_08___X1_4_STRTOKM_H
