from typing import Any, Callable, List, Optional, Union

import litellm
from litellm._logging import verbose_logger
from litellm.integrations.custom_logger import CustomLogger


class LoggingCallbackManager:
    """
    A centralized class that allows easy add / remove callbacks for litellm.

    Goals of this class:
    - Prevent adding duplicate callbacks / success_callback / failure_callback
    - Keep a reasonable MAX_CALLBACKS limit (this ensures callbacks don't exponentially grow and consume CPU Resources)
    """

    # healthy maximum number of callbacks - unlikely someone needs more than 20
    MAX_CALLBACKS = 20

    def add_input_callback(self, callback: Union[CustomLogger, str]):
        """
        Add a input callback to litellm.input_callback
        """
        self._safe_add_callback_to_list(
            callback=callback, parent_list=litellm.input_callback
        )

    def add_service_callback(self, callback: Union[CustomLogger, str, Callable]):
        """
        Add a service callback to litellm.service_callback
        """
        self._safe_add_callback_to_list(
            callback=callback, parent_list=litellm.service_callback
        )

    def add_callback(self, callback: Union[CustomLogger, str, Callable]):
        """
        Add a callback to litellm.callbacks

        Ensures no duplicates are added.
        """
        self._safe_add_callback_to_list(
            callback=callback, parent_list=litellm.callbacks  # type: ignore
        )

    def add_sync_success_callback(self, callback: Union[CustomLogger, str, Callable]):
        """
        Add a success callback to `litellm.success_callback`
        """
        self._safe_add_callback_to_list(
            callback=callback, parent_list=litellm.success_callback
        )

    def add_sync_failure_callback(self, callback: Union[CustomLogger, str, Callable]):
        """
        Add a failure callback to `litellm.failure_callback`
        """
        self._safe_add_callback_to_list(
            callback=callback, parent_list=litellm.failure_callback
        )

    def add_async_success_callback(self, callback: Union[CustomLogger, Callable, str]):
        """
        Add a success callback to litellm._async_success_callback
        """
        self._safe_add_callback_to_list(
            callback=callback, parent_list=litellm._async_success_callback
        )

    def add_async_failure_callback(self, callback: Union[CustomLogger, Callable, str]):
        """
        Add a failure callback to litellm._async_failure_callback
        """
        self._safe_add_callback_to_list(
            callback=callback, parent_list=litellm._async_failure_callback
        )

    def add_success_callback_sync_and_async(self, callback: Union[CustomLogger, str]):
        """
        Add a success callback to litellm.success_callback and litellm._async_success_callback
        """
        self.add_sync_success_callback(callback)
        self.add_async_success_callback(callback)
        pass

    def add_failure_callback_sync_and_async(self, callback: Union[CustomLogger, str]):
        """
        Add a failure callback to litellm.failure_callback and litellm._async_failure_callback
        """
        self.add_sync_failure_callback(callback)
        self.add_async_failure_callback(callback)

    def _add_string_callback_to_list(
        self, callback: str, parent_list: List[Union[CustomLogger, Callable, str]]
    ):
        """
        Add a string callback to a list, if the callback is already in the list, do not add it again.
        """
        if callback not in parent_list:
            parent_list.append(callback)
        else:
            verbose_logger.debug(
                f"Callback {callback} already exists in {parent_list}, not adding again.."
            )

    def _add_custom_logger_to_all_callback_lists(self, custom_logger: Optional[Any]):
        """
        Add a custom logger to all callback lists

        When a `litellm.callback` is set, it needs to be added to all callback lists.
        - `litellm.success_callback`
        - `litellm._async_success_callback`
        - `litellm.failure_callback`
        - `litellm._async_failure_callback`
        - `litellm.input_callback`
        - `litellm.service_callback`
        """
        if custom_logger is None:
            return
        if isinstance(custom_logger, CustomLogger):

            # success
            self.add_sync_success_callback(custom_logger)
            self.add_async_success_callback(custom_logger)

            # failure
            self.add_sync_failure_callback(custom_logger)
            self.add_async_failure_callback(custom_logger)

            # input
            self.add_input_callback(custom_logger)

            # service
            self.add_service_callback(custom_logger)

    def _safe_add_callback_to_list(
        self,
        callback: Union[CustomLogger, Callable, str],
        parent_list: List[Union[CustomLogger, Callable, str]],
    ):
        """
        Safe add a callback to a list, if the callback is already in the list, do not add it again.

        Ensures no duplicates are added for `str`, `Callable`, and `CustomLogger` callbacks.
        """
        if isinstance(callback, str):
            self._add_string_callback_to_list(
                callback=callback, parent_list=parent_list
            )
        elif isinstance(callback, Callable):
            self._add_callback_function_to_list(
                callback=callback, parent_list=parent_list
            )
        elif isinstance(callback, CustomLogger):
            self._add_custom_logger_to_list(
                custom_logger=callback,
                parent_list=parent_list,
            )

    def _add_callback_function_to_list(
        self, callback: Callable, parent_list: List[Union[CustomLogger, Callable, str]]
    ):
        """
        Add a callback function to a list, if the callback is already in the list, do not add it again.
        """
        # Check if the function already exists in the list by comparing function objects
        if callback not in parent_list:
            parent_list.append(callback)
        else:
            verbose_logger.debug(
                f"Callback function {callback.__name__} already exists in {parent_list}, not adding again.."
            )

    def _add_custom_logger_to_list(
        self,
        custom_logger: CustomLogger,
        parent_list: List[Union[CustomLogger, Callable, str]],
    ):
        """
        Add a custom logger to a list, if another instance of the same custom logger exists in the list, do not add it again.
        """
        # Check if an instance of the same class already exists in the list
        logger_class = custom_logger.__class__
        for existing_logger in parent_list:
            if isinstance(existing_logger, CustomLogger) and isinstance(
                existing_logger, logger_class
            ):
                verbose_logger.debug(
                    f"Custom logger of type {logger_class.__name__} already exists in {parent_list}, not adding again.."
                )
                return

        parent_list.append(custom_logger)

    def _reset_all_callbacks(self):
        """
        Reset all callbacks to an empty list

        Note: this is an internal function and should be used sparingly.
        """
        litellm.input_callback = []
        litellm.success_callback = []
        litellm.failure_callback = []
        litellm._async_success_callback = []
        litellm._async_failure_callback = []
